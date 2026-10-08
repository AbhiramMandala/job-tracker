"""JobSearchService: orchestrates cache → SerpApi → normalize → persist.

Slice 3: exact source_key + TF-IDF fuzzy dedup, job skill extraction,
and deterministic match refresh for the active candidate (if any).
Still NO evidence enrichment, NO LLM.
"""

import datetime as dt
import hashlib
import json
import logging
import time

from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import get_settings
from app.data.skills import extract_skills
from app.models import ApiUsage, Candidate, Company, Job, JobSkill, Search
from app.schemas.jobs import JobItem, JobsPage
from app.services.cache import CacheService, JOBS_TTL_HOURS, make_key
from app.services.deduplicator import apply_merge, is_duplicate_job, is_duplicate_norms
from app.services.matcher import refresh_matches
from app.services.normalizer import NormalizedJob, normalize_job
from app.services.serpapi_client import SerpApiClient, SerpApiError

logger = logging.getLogger(__name__)

MAX_PAGES = 2
ENGINE = "google_jobs"


class SearchResult:
    """Outcome of one run, for routes to render (no raw SerpApi inside)."""

    def __init__(
        self,
        search: Search,
        jobs: list[Job],
        raw_count: int,
        dup_removed: int,
        is_live: bool,
        stale: bool = False,
        gaps: list[dict] | None = None,
        has_profile: bool = False,
    ):
        self.search = search
        self.jobs = jobs
        self.raw_count = raw_count
        self.canonical_count = len(jobs)
        self.dup_removed = dup_removed
        self.is_live = is_live
        self.stale = stale
        self.gaps = gaps or []
        self.has_profile = has_profile


class JobSearchService:
    def __init__(
        self,
        db: Session,
        client: SerpApiClient | None = None,
        ttl_hours: int = JOBS_TTL_HOURS,
        max_pages: int = MAX_PAGES,
    ):
        self._db = db
        self._client = client
        self._ttl_hours = ttl_hours
        self._max_pages = max_pages
        self._cache = CacheService(db)

    # -- public API ----------------------------------------------------
    def run(self, role: str, location: str, experience: str) -> SearchResult:
        role, location, experience = self._validate(role, location, experience)
        params = {"q": role, "location": f"{location}, India", "gl": "in", "hl": "en"}

        hit = self._cache.get(ENGINE, params)
        if hit is not None:
            return self._persist_from_items(
                role, location, experience, params,
                [JobItem(**d) for d in hit.payload["items"]],
                raw_count=int(hit.payload.get("raw_count", 0)),
                is_live=False,
                retrieved_at=hit.retrieved_at,
                stale=False,
            )

        try:
            pages = self._fetch_pages(params)
        except SerpApiError:
            stale_hit = self._cache.get_stale(ENGINE, params)
            if stale_hit is not None:
                logger.warning("serpapi failed; serving stale cache q=%r", role)
                return self._persist_from_items(
                    role, location, experience, params,
                    [JobItem(**d) for d in stale_hit.payload["items"]],
                    raw_count=int(stale_hit.payload.get("raw_count", 0)),
                    is_live=False,
                    retrieved_at=stale_hit.retrieved_at,
                    stale=True,
                )
            raise

        items = [item for page in pages for item in page.items]
        raw_count = len(items)
        self._cache.set(
            ENGINE, params,
            {"items": [i.model_dump() for i in items], "raw_count": raw_count},
            self._ttl_hours,
        )
        return self._persist_from_items(
            role, location, experience, params, items, raw_count,
            is_live=True, retrieved_at=dt.datetime.now(dt.timezone.utc), stale=False,
        )

    # -- internals -----------------------------------------------------
    @staticmethod
    def _validate(role: str, location: str, experience: str) -> tuple[str, str, str]:
        role = (role or "").strip()
        location = (location or "").strip()
        experience = (experience or "").strip() or "Fresher"
        if not role:
            raise ValueError("Role must not be empty.")
        if not location:
            raise ValueError("Location must not be empty.")
        if len(role) > 200 or len(location) > 200 or len(experience) > 100:
            raise ValueError("Search input is too long.")
        return role, location, experience

    def _client_or_default(self) -> SerpApiClient:
        if self._client is not None:
            return self._client
        return SerpApiClient(api_key=get_settings().SERPAPI_KEY)

    def _fetch_pages(self, params: dict) -> list[JobsPage]:
        client = self._client_or_default()
        pages: list[JobsPage] = []
        next_token = ""
        page_stats: list[dict] = []
        for index in range(self._max_pages):
            started = time.monotonic()
            try:
                body = client.google_jobs(
                    q=params["q"],
                    location=params["location"],
                    gl=params["gl"],
                    hl=params["hl"],
                    next_page_token=next_token,
                )
                self._log_usage(params, "ok", 200, _elapsed_ms(started))
                self._db.commit()  # usage is durable even if later steps fail
            except SerpApiError as exc:
                self._db.rollback()
                self._log_usage(params, exc.kind, exc.http_status, _elapsed_ms(started))
                try:
                    self._db.commit()
                except Exception:
                    self._db.rollback()  # never mask the original search error
                if pages:
                    # Page 1 (or earlier) succeeded: return what we have
                    # rather than failing the whole search. Page-1-only
                    # failure keeps the existing raise path (stale/503).
                    logger.warning(
                        "discovery page %d failed kind=%s; returning %d earlier page(s)",
                        index + 1, exc.kind, len(pages))
                    break
                raise
            page = _parse_page(body)
            pages.append(page)
            page_stats.append({
                "page": index + 1,
                "ms": _elapsed_ms(started),
                "raw": len(page.items),
            })
            next_token = page.next_page_token
            if not next_token:
                break
        logger.info(
            "discovery q=%r pages=%d stats=%s", params["q"], len(pages), page_stats)
        return pages

    def _persist_from_items(
        self,
        role: str,
        location: str,
        experience: str,
        params: dict,
        items: list[JobItem],
        raw_count: int,
        is_live: bool,
        retrieved_at: dt.datetime,
        stale: bool,
    ) -> SearchResult:
        query_hash = hashlib.sha256(
            f"{role.lower()}|{location.lower()}|{experience.lower()}".encode()
        ).hexdigest()
        search = self._db.query(Search).filter_by(query_hash=query_hash).one_or_none()
        if search is None:
            search = Search(
                role=role, location=location, experience=experience,
                query_hash=query_hash,
            )
            self._db.add(search)
            self._db.flush()

        seen: dict[str, NormalizedJob] = {}
        for item in items:
            norm = normalize_job(item)
            if norm.source_key not in seen:
                seen[norm.source_key] = norm
            # else: exact intra-fetch duplicate — collapsed, counted later
        norms = list(seen.values())

        # One bounded query: recent canonicals for fuzzy comparison.
        db_candidates: list[Job] = (
            self._db.query(Job)
            .options(joinedload(Job.company))
            .filter(Job.is_active == True)  # noqa: E712
            .order_by(Job.last_seen.desc())
            .limit(500)
            .all()
        )
        processed: list[tuple[Job, str]] = []  # canonicals touched this run
        processed_ids: set[int] = set()
        touched: dict[int, Job] = {}
        for norm in norms:
            job = self._merge_or_create(
                search, norm, retrieved_at, db_candidates, processed, processed_ids
            )
            touched[job.id] = job
        jobs = list(touched.values())
        dup_removed = raw_count - len(jobs)

        search.raw_count = raw_count
        search.canonical_count = len(jobs)
        search.dup_removed = dup_removed
        search.is_live = is_live
        search.retrieved_at = retrieved_at
        self._extract_job_skills(jobs)
        candidate = (
            self._db.query(Candidate)
            .filter_by(is_active=True)
            .order_by(Candidate.id)
            .first()
        )
        gaps = (
            refresh_matches(self._db, search.id, jobs, candidate)
            if candidate is not None
            else []
        )
        self._db.commit()
        # Re-attach fresh instances for rendering after commit.
        ids = [j.id for j in jobs]
        jobs = (
            self._db.query(Job)
            .options(selectinload(Job.company))
            .filter(Job.id.in_(ids))
            .all()
            if ids
            else []
        )
        order = {job_id: position for position, job_id in enumerate(ids)}
        jobs.sort(key=lambda j: order.get(j.id, 0))
        return SearchResult(
            search, jobs, raw_count, dup_removed, is_live, stale,
            gaps=gaps, has_profile=candidate is not None,
        )

    def _merge_or_create(
        self,
        search: Search,
        norm: NormalizedJob,
        seen_at: dt.datetime,
        db_candidates: list[Job],
        processed: list[tuple[Job, str]],
        processed_ids: set[int],
    ) -> Job:
        exact = self._db.query(Job).filter_by(source_key=norm.source_key).one_or_none()
        if exact is not None:
            exact.search_id = search.id
            apply_merge(exact, norm, seen_at)
            self._db.flush()
            if exact.id not in processed_ids:
                processed.append((exact, self._company_norm_of(exact)))
                processed_ids.add(exact.id)
            return exact
        for job, company_norm in processed:
            if is_duplicate_norms(norm, self._norm_like(job, company_norm)):
                job.search_id = search.id
                apply_merge(job, norm, seen_at)
                self._db.flush()
                return job
        for job in db_candidates:
            if job.id in processed_ids:
                continue
            company_norm = self._company_norm_of(job)
            if is_duplicate_job(norm, job, company_norm):
                job.search_id = search.id
                apply_merge(job, norm, seen_at)
                self._db.flush()
                processed.append((job, company_norm))
                processed_ids.add(job.id)
                return job
        job = self._create_job(search, norm, seen_at)
        processed.append((job, norm.company_norm))
        processed_ids.add(job.id)
        return job

    @staticmethod
    def _company_norm_of(job: Job) -> str:
        company = job.company
        return company.name_norm if company is not None else ""

    @staticmethod
    def _norm_like(job: Job, company_norm: str) -> NormalizedJob:
        """Adapt a persisted canonical to the NormalizedJob shape for comparison."""
        return NormalizedJob(
            title_raw=job.title_raw or "",
            title_norm=job.title_norm or "",
            company_raw="",
            company_norm=company_norm,
            location_raw=job.location_raw or "",
            location_norm=job.location_norm or "",
            description=job.description or "",
            source_key=job.source_key,
        )

    def _get_or_create_company(self, norm: NormalizedJob) -> Company:
        company = (
            self._db.query(Company).filter_by(name_norm=norm.company_norm).one_or_none()
        )
        if company is None:
            company = Company(
                name_raw=norm.company_raw or "Unknown company",
                name_norm=norm.company_norm,
            )
            self._db.add(company)
            self._db.flush()
        return company

    def _create_job(self, search: Search, norm: NormalizedJob, seen_at: dt.datetime) -> Job:
        company = self._get_or_create_company(norm)
        job = Job(
            search_id=search.id,
            company_id=company.id,
            title_raw=norm.title_raw,
            title_norm=norm.title_norm,
            location_raw=norm.location_raw,
            location_norm=norm.location_norm,
            via=json.dumps(norm.via_list),
            apply_link=norm.apply_link,
            description=norm.description,
            posted_text=norm.posted_text,
            salary_text=norm.salary_text,
            source_key=norm.source_key,
            serpapi_job_id=norm.serpapi_job_id,
            extra_links="[]",
            first_seen=seen_at,
            last_seen=seen_at,
        )
        self._db.add(job)
        self._db.flush()
        return job

    def _extract_job_skills(self, jobs: list[Job]) -> None:
        for job in jobs:
            for skill_norm, snippet in extract_skills(
                f"{job.title_raw or ''}\n{job.description or ''}"
            ):
                existing = (
                    self._db.query(JobSkill)
                    .filter_by(job_id=job.id, skill_norm=skill_norm)
                    .one_or_none()
                )
                if existing is None:
                    self._db.add(
                        JobSkill(
                            job_id=job.id,
                            skill_norm=skill_norm,
                            evidence_snippet=snippet[:200],
                        )
                    )
                elif not existing.evidence_snippet and snippet:
                    existing.evidence_snippet = snippet[:200]
        self._db.flush()

    def _log_usage(self, params: dict, status: str, http_status: int, duration_ms: int) -> None:
        self._db.add(
            ApiUsage(
                engine=ENGINE,
                query=params["q"],
                params_hash=make_key(ENGINE, params),
                status=status,
                http_status=http_status,
                duration_ms=duration_ms,
            )
        )
        self._db.flush()


def _parse_page(body: dict) -> JobsPage:
    raw_items = body.get("jobs_results")
    if raw_items is None:
        raise SerpApiError("parse", "SerpApi response has no jobs_results.")
    if not isinstance(raw_items, list):
        raise SerpApiError("parse", "SerpApi jobs_results has an unexpected shape.")
    items = [JobItem.from_serpapi(raw) for raw in raw_items]
    pagination = body.get("serpapi_pagination")
    token = ""
    if isinstance(pagination, dict):
        token = str(pagination.get("next_page_token") or "")
    return JobsPage(items=items, next_page_token=token)


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
