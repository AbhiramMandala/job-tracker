"""EvidenceService: Google Search enrichment + deterministic classification.

Pillar: VERIFY. No LLM, no numeric trust scores — only observable signals
with inspectable sources. Sequential, bounded requests; failures degrade to
stale cache, then to an honest "unavailable" state. Never fabricates.
"""

import datetime as dt
import logging
import time
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import ApiUsage, Evidence, Job
from app.schemas.search import OrganicResult, parse_organic_results
from app.services.cache import CacheService, make_key
from app.services.serpapi_client import SerpApiClient, SerpApiError
from app.utils import domain_of, normalize_url, official_site_match

logger = logging.getLogger(__name__)

ENGINE = "google"
STATUS_SUPPORTING = "supporting"
STATUS_NEEDS = "needs_verification"
STATUS_WARNING = "warning"
STATUS_UNAVAILABLE = "unavailable"

TYPE_JOB = "job_presence"
TYPE_LOCATION = "location_presence"
TYPE_WEBSITE = "company_website"
TYPE_COMPANY = "company_presence"
TYPE_WARNING = "warning_signal"


@dataclass
class VerificationSummary:
    job_id: int
    status: str  # supporting | needs_verification | warning | unavailable
    reasons: list[str] = field(default_factory=list)
    supporting_count: int = 0
    warning_count: int = 0
    source_count: int = 0
    retrieved_at: dt.datetime | None = None
    is_live: bool = False
    stale: bool = False


class EvidenceService:
    def __init__(
        self,
        db: Session,
        client: SerpApiClient | None = None,
        max_jobs: int | None = None,
        ttl_hours: int | None = None,
    ):
        settings = get_settings()
        self._db = db
        self._client = client
        self._max_jobs = settings.EVIDENCE_MAX_JOBS if max_jobs is None else max_jobs
        self._ttl = settings.EVIDENCE_TTL_HOURS if ttl_hours is None else ttl_hours
        self._cache = CacheService(db)

    @property
    def max_jobs(self) -> int:
        return self._max_jobs

    # -- public API ----------------------------------------------------
    def enrich(
        self, jobs: list[Job], totals: dict[int, int] | None = None
    ) -> dict[int, VerificationSummary]:
        """Enrich the top-N jobs. Returns summaries keyed by job id."""
        totals = totals or {}
        ranked = sorted(jobs, key=lambda j: totals.get(j.id, 0), reverse=True)
        summaries: dict[int, VerificationSummary] = {}
        for job in ranked[: max(0, self._max_jobs)]:
            summaries[job.id] = self.enrich_job(job)
        self._db.commit()
        return summaries

    def enrich_job(self, job: Job) -> VerificationSummary:
        company = job.company
        company_raw = (company.name_raw if company else "").strip()
        company_norm = (company.name_norm if company else "").strip()
        if not company_norm:
            row = self._upsert_warning(
                job, "Listing provides no company information to check."
            )
            self._db.flush()
            return VerificationSummary(
                job_id=job.id, status=STATUS_WARNING,
                reasons=["! Listing provides no company information to check."],
                warning_count=1, source_count=0, retrieved_at=row.retrieved_at,
            )

        title_part = (job.title_raw or "")[:80]
        city = (job.location_raw or "").split(",")[0].strip()
        queries = [(TYPE_JOB, f'"{company_raw}" "{title_part}"')]
        if city:
            queries.append((TYPE_LOCATION, f'"{company_raw}" {city}'))

        http_made = False
        stale = False
        counts: dict[str, int] = {}
        for evidence_type, query in queries:
            body, fresh_http, used_stale = self._fetch(query)
            http_made = http_made or fresh_http
            stale = stale or used_stale
            results = parse_organic_results(body) if body is not None else None
            if results is None:
                continue  # total failure for this query, no data at all
            counts[evidence_type] = len(results)
            self._store_results(job, evidence_type, query, results, city)
        self._db.flush()
        return self._classify(job, company_raw, company_norm, city, counts, http_made, stale)

    # -- fetch (cache → HTTP → stale) -----------------------------------
    def _fetch(self, query: str) -> tuple[dict | None, bool, bool]:
        """Returns (body, http_made, used_stale). body None only on total failure."""
        params = {"q": query, "gl": "in", "hl": "en"}
        hit = self._cache.get(ENGINE, params)
        if hit is not None:
            return hit.payload, False, False
        client = self._client or SerpApiClient(api_key=get_settings().SERPAPI_KEY)
        started = time.monotonic()
        try:
            body = client.google_search(q=query, gl="in", hl="en")
        except SerpApiError as exc:
            self._log_usage(query, exc.kind, exc.http_status, _elapsed_ms(started))
            self._commit_best_effort()
            stale_hit = self._cache.get_stale(ENGINE, params)
            if stale_hit is not None:
                logger.warning("evidence live failed; using stale q=%r", query)
                return stale_hit.payload, False, True
            logger.warning("evidence unavailable q=%r kind=%s", query, exc.kind)
            return None, False, False
        self._log_usage(query, "ok", 200, _elapsed_ms(started))
        self._cache.set(ENGINE, params, body, self._ttl)
        self._commit_best_effort()
        return body, True, False

    # -- persistence ------------------------------------------------------
    def _store_results(
        self, job: Job, evidence_type: str, query: str,
        results: list[OrganicResult], city: str,
    ) -> None:
        now = dt.datetime.now(dt.timezone.utc)
        # Identity is (job, normalized URL) across ALL types: the same source
        # found by both queries stays one row (first query's type wins).
        existing = {
            normalize_url(row.source_url): row
            for row in self._db.query(Evidence).filter_by(job_id=job.id).all()
            if row.source_url
        }
        for result in results:
            key = normalize_url(result.link)
            typed, claim, category = self._type_row(job, result, evidence_type, city)
            row = existing.get(key)
            if row is None:
                row = Evidence(
                    job_id=job.id, company_id=job.company_id, engine=ENGINE,
                    query=query, evidence_type=typed, claim=claim, category=category,
                    source_title=result.title[:300], source_url=result.link,
                    source_snippet=result.snippet[:500], retrieved_at=now,
                )
                self._db.add(row)
            else:
                # Same source seen again: refresh content, keep first type.
                row.query = query
                row.source_title = result.title[:300]
                row.source_snippet = result.snippet[:500]
                row.retrieved_at = now
        self._db.flush()

    def _type_row(
        self, job: Job, result: OrganicResult, query_type: str, city: str
    ) -> tuple[str, str, str]:
        company = job.company
        company_norm = company.name_norm if company else ""
        text = f"{result.title} {result.snippet} {domain_of(result.link)}".lower()
        tokens = company_norm.split()
        matched = sum(1 for t in tokens if t and t in text)
        title_tokens = set((job.title_norm or "").split())
        result_tokens = set(text.replace("/", " ").split()) - {"and", "for", "with", "the"}
        title_hit = bool(title_tokens & result_tokens)
        if official_site_match(company_norm, result.link):
            return (
                TYPE_WEBSITE, "Official company website found in search results.",
                "supporting",
            )
        if query_type == TYPE_JOB and matched and title_hit:
            return (
                TYPE_JOB, "Search result connects the company to this role.",
                "supporting",
            )
        if query_type == TYPE_LOCATION and matched and city and city.lower() in text:
            return (
                TYPE_LOCATION, f"Search result supports a {city} presence.",
                "supporting",
            )
        if matched >= max(1, (len(tokens) + 1) // 2):
            return TYPE_COMPANY, "Company name appears in search results.", "supporting"
        return (
            TYPE_COMPANY, "Search result mentions a similar name; identity unclear.",
            "limited",
        )

    def _upsert_warning(self, job: Job, claim: str) -> Evidence:
        now = dt.datetime.now(dt.timezone.utc)
        row = (
            self._db.query(Evidence)
            .filter_by(job_id=job.id, evidence_type=TYPE_WARNING, source_url="")
            .first()
        )
        # One warning row per distinct claim; lookup by claim among warnings.
        if row is None:
            row = (
                self._db.query(Evidence)
                .filter_by(job_id=job.id, evidence_type=TYPE_WARNING)
                .filter(Evidence.claim == claim)
                .first()
            )
        if row is None:
            row = Evidence(
                job_id=job.id, company_id=job.company_id, engine=ENGINE,
                query="", evidence_type=TYPE_WARNING, claim=claim,
                category="warning", retrieved_at=now,
            )
            self._db.add(row)
        else:
            row.retrieved_at = now
        return row

    # -- classification ----------------------------------------------------
    def _classify(
        self, job: Job, company_raw: str, company_norm: str, city: str,
        counts: dict[str, int], http_made: bool, stale: bool,
    ) -> VerificationSummary:
        rows = self._db.query(Evidence).filter_by(job_id=job.id).all()
        if not rows and not counts:
            return VerificationSummary(job_id=job.id, status=STATUS_UNAVAILABLE)
        by_type: dict[str, list[Evidence]] = {}
        for row in rows:
            by_type.setdefault(row.evidence_type, []).append(row)
        warnings = by_type.get(TYPE_WARNING, [])
        reasons: list[str] = []
        supporting = 0

        domains = {
            domain_of(r.source_url) for r in rows
            if domain_of(r.source_url) and not r.evidence_type.startswith("news_")
        }
        presence = [
            r for r in rows
            if r.evidence_type in (TYPE_COMPANY, TYPE_JOB)
            and r.category == "supporting"
        ]
        if presence:
            reasons.append(
                f"✓ Company appears in {len(presence)} supporting result"
                f"{'s' if len(presence) != 1 else ''} across {len(domains)} site"
                f"{'s' if len(domains) != 1 else ''}."
            )
            supporting += 1
        website = by_type.get(TYPE_WEBSITE, [])
        if website:
            reasons.append(f"✓ Official website found ({domain_of(website[0].source_url)}).")
            supporting += 1
        job_rows = [r for r in by_type.get(TYPE_JOB, []) if r.category == "supporting"]
        if job_rows:
            reasons.append("✓ Search results connect the company to this role.")
            supporting += 1
        location_rows = [
            r for r in by_type.get(TYPE_LOCATION, []) if r.category == "supporting"
        ]
        if city and location_rows:
            reasons.append(f"✓ {city} presence supported by search results.")
            supporting += 1
        elif city and TYPE_LOCATION in counts:
            reasons.append(f"! {city} presence could not be independently confirmed.")
        if not rows or (
            sum(counts.values()) == 0 and counts
        ):
            claim = "No independent search presence found for this company."
            self._upsert_warning(job, claim)
            self._db.flush()
            warnings = self._db.query(Evidence).filter_by(
                job_id=job.id, evidence_type=TYPE_WARNING).all()
            reasons.append(f"! {claim}")
        elif presence or website or job_rows:
            # Evidence now exists: retire the stale zero-presence warning.
            self._db.query(Evidence).filter_by(
                job_id=job.id, evidence_type=TYPE_WARNING,
                claim="No independent search presence found for this company.",
            ).delete()
            warnings = [
                w for w in warnings
                if w.claim != "No independent search presence found for this company."
            ]
        if (
            len(domains) >= 4 and not website
            and sum(1 for r in rows if r.category == "supporting") >= 2
        ):
            reasons.append(
                "! Ambiguous identity — several distinct sites use this company name."
            )
        for warning in warnings:
            if warning.claim not in [r[2:] for r in reasons]:
                reasons.append(f"! {warning.claim}")

        if warnings:
            status = STATUS_WARNING
        elif supporting >= 2:
            status = STATUS_SUPPORTING
        elif rows:
            status = STATUS_NEEDS
            if not any(r.startswith("!") or r.startswith("✓") for r in reasons):
                reasons.append("! Limited evidence available for this listing.")
        else:
            return VerificationSummary(job_id=job.id, status=STATUS_UNAVAILABLE)

        retrieved = max(
            (r.retrieved_at for r in rows if r.retrieved_at),
            default=None,
        )
        sources = sum(1 for r in rows if r.source_url)
        return VerificationSummary(
            job_id=job.id, status=status, reasons=reasons,
            supporting_count=supporting, warning_count=len(warnings),
            source_count=sources, retrieved_at=retrieved,
            is_live=http_made and not stale, stale=stale,
        )

    # -- usage logging ------------------------------------------------------
    def _log_usage(self, query: str, status: str, http_status: int, duration_ms: int) -> None:
        self._db.add(
            ApiUsage(
                engine=ENGINE, query=query,
                params_hash=make_key(ENGINE, {"q": query, "gl": "in", "hl": "en"}),
                status=status, http_status=http_status, duration_ms=duration_ms,
            )
        )
        self._db.flush()

    def _commit_best_effort(self) -> None:
        try:
            self._db.commit()
        except Exception:
            self._db.rollback()


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
