"""NewsService: recent company context via Google News. Context, not verdicts.

Categories are keyword rules over title+snippet — a filing system, not
sentiment analysis. No numeric scores, no safe/unsafe labels. A workforce
reduction is reported as "Recent news includes a report about workforce
reductions", never "this company is risky". Failures never break search:
they degrade to stale rows, then to an honest unavailable state.
"""

import datetime as dt
import logging
import time
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import ApiUsage, Evidence, Job
from app.schemas.search import NewsItem, parse_news_results
from app.services.cache import CacheService, make_key
from app.services.serpapi_client import SerpApiClient, SerpApiError
from app.utils import age_text, domain_of, normalize_url, official_site_match

logger = logging.getLogger(__name__)

ENGINE = "google_news"
NEWS_TYPE_PREFIX = "news_"

CATEGORY_LABELS = {
    "layoff": "Workforce reduction",
    "restructuring": "Restructuring",
    "shutdown": "Shutdown / closure",
    "acquisition": "Acquisition / merger",
    "funding": "Funding",
    "expansion": "Expansion",
    "regulatory": "Regulatory / legal",
    "company_update": "Company update",
}

# Ordered: workforce-impacting categories first so "layoffs amid
# acquisition talks" files under layoff, the fresher-relevant reading.
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("layoff", ["layoff", "layoffs", "job cuts", "workforce reduction",
                "downsizing", "retrench", "pink slip"]),
    ("shutdown", ["shutdown", "shuts down", "shutting down", "closes operations",
                  "bankrupt", "insolvency"]),
    ("restructuring", ["restructur"]),
    ("acquisition", ["acquisition", "acquires", "acquired", "merger",
                     "merges with", "takeover"]),
    ("funding", ["funding", "raises", "raised", "series a", "series b",
                 "series c", "investment", "investor"]),
    # "office" alone is intentionally broad (company-news queries make it
    # expansion-leaning); the headline is always displayed so users see
    # through miscategorization. Documented in docs/verification.md.
    ("expansion", ["expansion", "expands", "new office", "new branch",
                   "new centre", "new center", "new facility", "new campus",
                   "office", "inaugurat"]),
    ("regulatory", ["regulator", "lawsuit", "fined", "penalty", "probe",
                    "investigation"]),
]

ATTENTION_CATEGORIES = {"layoff", "restructuring", "shutdown"}


def categorize(title: str, snippet: str) -> str:
    blob = f"{title or ''} {snippet or ''}".lower()
    for category, keywords in CATEGORY_RULES:
        if any(kw in blob for kw in keywords):
            return category
    return "company_update"


def category_label(category: str) -> str:
    return CATEGORY_LABELS.get(category, "Company update")


def relates_to_company(item: NewsItem, company_norm: str) -> bool:
    """Drop results that clearly concern a different organization.

    Requires a majority of company tokens in title+snippet+domain, or an
    official-domain match. Generic names that match nothing are skipped
    rather than attached to the wrong employer.
    """
    tokens = [t for t in (company_norm or "").split() if t]
    if not tokens:
        return False
    text = f"{item.title} {item.snippet} {domain_of(item.link)}".lower()
    matched = sum(1 for t in tokens if t in text)
    if matched >= max(1, (len(tokens) + 1) // 2):
        return True
    return official_site_match(company_norm, item.link)


def date_display(iso_date: str, raw_date: str) -> str:
    """Relative age from iso_date; raw string fallback; never fabricated."""
    if iso_date:
        try:
            moment = dt.datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
            return age_text(moment)
        except ValueError:
            pass
    if raw_date:
        return raw_date[:120]
    return "Date unavailable"


@dataclass
class NewsDigest:
    job_id: int
    state: str  # ok | empty | ambiguous | stale | unavailable
    items: list[dict] = field(default_factory=list)
    is_live: bool = False
    stale: bool = False


class NewsService:
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
        self._max_jobs = settings.NEWS_MAX_JOBS if max_jobs is None else max_jobs
        self._ttl = settings.NEWS_TTL_HOURS if ttl_hours is None else ttl_hours
        self._cache = CacheService(db)

    @property
    def max_jobs(self) -> int:
        return self._max_jobs

    def enrich_top(
        self, jobs: list[Job], totals: dict[int, int] | None = None
    ) -> dict[int, NewsDigest]:
        """Pre-enrich the top-N jobs during search. Bounded, sequential."""
        totals = totals or {}
        ranked = sorted(jobs, key=lambda j: totals.get(j.id, 0), reverse=True)
        digests: dict[int, NewsDigest] = {}
        for job in ranked[: max(0, self._max_jobs)]:
            try:
                digests[job.id] = self.enrich_job(job)
            except Exception:
                logger.exception("news enrichment failed job=%s", job.id)
                digests[job.id] = NewsDigest(job_id=job.id, state="unavailable")
        self._db.commit()
        return digests

    def ensure_for_job(self, job: Job) -> NewsDigest:
        """On-demand refresh for the detail page: fetch only without fresh rows."""
        if self._has_fresh_rows(job.id):
            return self._digest_from_rows(job.id, is_live=False, stale=False)
        try:
            return self.enrich_job(job, commit=True)
        except Exception:
            logger.exception("news on-demand failed job=%s", job.id)
            stale_rows = self._news_rows(job.id)
            if stale_rows:
                return self._digest_from_rows(job.id, is_live=False, stale=True)
            return NewsDigest(job_id=job.id, state="unavailable")

    def enrich_job(self, job: Job, commit: bool = False) -> NewsDigest:
        company = job.company
        company_raw = (company.name_raw if company else "").strip()
        company_norm = (company.name_norm if company else "").strip()
        if not company_norm:
            return NewsDigest(job_id=job.id, state="ambiguous")
        city = (job.location_raw or "").split(",")[0].strip()
        query = f'"{company_raw}" {city}' if city else f'"{company_raw}"'
        body, http_made, used_stale = self._fetch(query)
        if body is None:
            rows = self._news_rows(job.id)
            if rows:
                return self._digest_from_rows(job.id, is_live=False, stale=True)
            return NewsDigest(job_id=job.id, state="unavailable")
        items = parse_news_results(body)
        if not items:
            return NewsDigest(job_id=job.id, state="empty",
                              is_live=http_made and not used_stale, stale=used_stale)
        related = [i for i in items if relates_to_company(i, company_norm)]
        if not related:
            return NewsDigest(job_id=job.id, state="ambiguous",
                              is_live=http_made and not used_stale, stale=used_stale)
        self._store(job, query, related)
        self._db.flush()
        if commit:
            self._db.commit()
        return self._digest_from_rows(job.id, is_live=http_made and not used_stale,
                                      stale=used_stale)

    # -- internals -----------------------------------------------------
    def _fetch(self, query: str) -> tuple[dict | None, bool, bool]:
        params = {"q": query, "gl": "in", "hl": "en"}
        hit = self._cache.get(ENGINE, params)
        if hit is not None:
            return hit.payload, False, False
        client = self._client or SerpApiClient(api_key=get_settings().SERPAPI_KEY)
        started = time.monotonic()
        try:
            body = client.google_news(q=query, gl="in", hl="en")
        except SerpApiError as exc:
            self._log_usage(query, exc.kind, exc.http_status, _elapsed_ms(started))
            self._commit_best_effort()
            stale_hit = self._cache.get_stale(ENGINE, params)
            if stale_hit is not None:
                return stale_hit.payload, False, True
            return None, False, False
        self._log_usage(query, "ok", 200, _elapsed_ms(started))
        self._cache.set(ENGINE, params, body, self._ttl)
        self._commit_best_effort()
        return body, True, False

    def _store(self, job: Job, query: str, items: list[NewsItem]) -> None:
        now = dt.datetime.now(dt.timezone.utc)
        existing = {
            normalize_url(row.source_url): row
            for row in self._news_rows(job.id)
            if row.source_url
        }
        for item in items:
            key = normalize_url(item.link)
            category = categorize(item.title, item.snippet)
            row = existing.get(key)
            if row is None:
                self._db.add(
                    Evidence(
                        job_id=job.id, company_id=job.company_id, engine=ENGINE,
                        query=query, evidence_type=f"{NEWS_TYPE_PREFIX}{category}",
                        claim=f"News: {category_label(category)}.",
                        category="context",
                        source_title=item.title[:300], source_url=item.link,
                        source_snippet=item.snippet[:500],
                        source_date=item.iso_date or item.date,
                        retrieved_at=now,
                    )
                )
            else:
                row.evidence_type = f"{NEWS_TYPE_PREFIX}{category}"
                row.claim = f"News: {category_label(category)}."
                row.query = query
                row.source_title = item.title[:300]
                row.source_snippet = item.snippet[:500]
                row.source_date = item.iso_date or item.date
                row.retrieved_at = now

    def _news_rows(self, job_id: int) -> list[Evidence]:
        return (
            self._db.query(Evidence)
            .filter(Evidence.job_id == job_id)
            .filter(Evidence.evidence_type.startswith(NEWS_TYPE_PREFIX))
            .order_by(Evidence.retrieved_at.desc())
            .all()
        )

    def _has_fresh_rows(self, job_id: int) -> bool:
        rows = self._news_rows(job_id)
        if not rows:
            return False
        now = dt.datetime.now(dt.timezone.utc)
        newest = max((r.retrieved_at for r in rows if r.retrieved_at), default=None)
        if newest is None:
            return False
        if newest.tzinfo is None:
            newest = newest.replace(tzinfo=dt.timezone.utc)
        return (now - newest) <= dt.timedelta(hours=self._ttl)

    def _digest_from_rows(
        self, job_id: int, is_live: bool, stale: bool
    ) -> NewsDigest:
        items = [
            {
                "title": row.source_title or "(untitled)",
                "source": _source_name(row),
                "url": row.source_url,
                "date_display": date_display(row.source_date or "", ""),
                "category": row.evidence_type[len(NEWS_TYPE_PREFIX):],
                "label": category_label(row.evidence_type[len(NEWS_TYPE_PREFIX):]),
                "attention": row.evidence_type[len(NEWS_TYPE_PREFIX):]
                in ATTENTION_CATEGORIES,
            }
            for row in self._news_rows(job_id)
            if row.source_url
        ]
        if not items:
            return NewsDigest(job_id=job_id, state="empty",
                              is_live=is_live, stale=stale)
        state = "stale" if stale else "ok"
        return NewsDigest(job_id=job_id, state=state, items=items,
                          is_live=is_live, stale=stale)

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


def _source_name(row: Evidence) -> str:
    from app.utils import domain_of

    return domain_of(row.source_url) or "source"


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
