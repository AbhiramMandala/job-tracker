"""InterviewService: candidate-reported selection-process context.

Compliance-first design (see docs/interviews.md):
- Sources come ONLY from SerpApi organic-search results. JobSetu never
  scrapes review sites and never bypasses auth, CAPTCHAs, paywalls, robots
  rules, or anti-bot mechanisms.
- Never reproduces long review text: stores short source titles plus concise
  factual stage summaries with full attribution (source, URL, retrieval time).
- Everything is labeled candidate-reported, never official company policy.
- Stages need >= 2 independent reports to count as established; anything less
  is labeled limited/anecdotal. With <= 2 total reports the whole digest is
  flagged limited.
- Failures degrade to stale rows, then to an honest unavailable state, and
  never break search.

Credit discipline: at most 2 queries per job for the top-N jobs
(INTERVIEW_MAX_JOBS), sequential, cached 7 days, usage-logged under the
existing "google" engine label.
"""

import datetime as dt
import logging
import re
import time
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.config import get_settings
from app.data.prep import PREP_POINTERS
from app.data.skills import display_skill, extract_skills
from app.models import ApiUsage, Evidence, Job
from app.schemas.search import OrganicResult, parse_organic_results
from app.services.cache import CacheService, make_key
from app.services.serpapi_client import SerpApiClient, SerpApiError
from app.services.deduplicator import pair_similarity
from app.utils import age_text, domain_of, normalize_url, official_site_match, safe_url

logger = logging.getLogger(__name__)

ENGINE = "google"  # organic search; queries distinguish interview usage
INTERVIEW_PREFIX = "interview_"

# Near-identical reports (reposts, aggregators) cluster at this text
# similarity so one report is never counted twice.
FINGERPRINT_THRESHOLD = 0.9

# Domain fragments marking candidate-experience platforms vs open discussion.
CANDIDATE_PLATFORMS = ("glassdoor", "ambitionbox", "indeed")
COMMUNITY_PLATFORMS = ("reddit", "quora", "teamblind")

INTERVIEW_DISCLAIMER = (
    "Selection-process information is candidate-reported and reflects "
    "individual experiences, not official company policy. Stages seen in "
    "fewer than two independent reports are labeled anecdotal."
)

# Ordered stage taxonomy. detect_stages returns EVERY matching stage so one
# report can support several stages. Keyword filing, not sentiment analysis.
STAGE_RULES: list[tuple[str, str, list[str]]] = [
    ("online_assessment", "Online assessment",
     ["online assessment", "online test", "assessment test", "coding test",
      "coding round", "hackerrank", "hackerearth", "codility", "amcat", "cocubes"]),
    ("aptitude", "Aptitude test",
     ["aptitude", "logical reasoning", "quantitative", "verbal ability"]),
    ("technical", "Technical interview",
     ["technical interview", "technical round", "tech interview",
      "technical discussion", "technical hr"]),
    ("managerial", "Managerial round",
     ["managerial", "manager round", "leadership round"]),
    ("hr", "HR interview",
     ["hr interview", "hr round", "hr discussion"]),
    ("group_discussion", "Group discussion",
     ["group discussion", "gd round"]),
    ("case_study", "Case study / assignment",
     ["case study", "case interview", "assignment round", "take-home", "take home"]),
    ("telephonic", "Telephonic screening",
     ["telephonic", "phone screening", "phone screen", "screening call"]),
]

STAGE_LABELS = {stage: label for stage, label, _ in STAGE_RULES}


def detect_stages(title: str, snippet: str) -> list[str]:
    """All stages mentioned in a result. Empty when none match."""
    blob = f"{title or ''} {snippet or ''}".lower()
    return [stage for stage, _, keywords in STAGE_RULES
            if any(kw in blob for kw in keywords)]


def stage_label(stage: str) -> str:
    return STAGE_LABELS.get(stage, "Interview stage")


def report_strength(link: str, company_norm: str) -> str:
    """Evidence tier for one report URL. Never a quality verdict."""
    host = domain_of(link or "")
    if company_norm and official_site_match(company_norm, link):
        return "Official"
    if any(fragment in host for fragment in CANDIDATE_PLATFORMS):
        return "Candidate-reported"
    if any(fragment in host for fragment in COMMUNITY_PLATFORMS):
        return "Community-reported"
    return "Search-derived"


def relates_to_company(title: str, snippet: str, link: str, company_norm: str) -> bool:
    """Drop results that clearly concern a different organization.

    Majority-token rule over word boundaries (so the token "tech" does not
    match inside the word "technical"), plus an official-domain fallback.
    Generic names that match nothing are skipped rather than attached to the
    wrong employer. Stricter than substring matching on purpose:
    wrong-company interview data is more harmful than a missed report.
    Documented in docs/interviews.md.
    """
    tokens = [t for t in (company_norm or "").split() if t]
    if not tokens:
        return False
    text = f"{title} {snippet} {domain_of(link)}".lower()
    matched = sum(1 for t in tokens
                  if re.search(r"\b" + re.escape(t) + r"\b", text))
    if matched >= max(1, (len(tokens) + 1) // 2):
        return True
    return official_site_match(company_norm, link)
    tokens = [t for t in (company_norm or "").split() if t]
    if not tokens:
        return False
    text = f"{title} {snippet} {domain_of(link)}".lower()
    matched = sum(1 for t in tokens if t in text)
    if matched >= max(1, (len(tokens) + 1) // 2):
        return True
    return official_site_match(company_norm, link)


@dataclass
class InterviewDigest:
    job_id: int
    state: str  # ok | empty | unavailable | stale
    stages: list[dict] = field(default_factory=list)
    reports: list[dict] = field(default_factory=list)
    total_reports: int = 0
    duplicates_merged: int = 0
    checked: str = ""
    limited: bool = False
    is_live: bool = False
    stale: bool = False


def summarize_reports(job_id: int, rows: list[Evidence],
                      company_norm: str = "",
                      is_live: bool = False, stale: bool = False) -> InterviewDigest:
    """Pure aggregation over stored interview rows. No I/O.

    Dedup works in two layers: identical URLs merge first, then
    near-identical report texts cluster by fingerprint (>= 0.9 trigram
    similarity) so reposts/aggregators never double-count. A stage counts
    DISTINCT source domains (independent reports); stages with < 2 domains
    are anecdotal. A digest with <= 2 total reports is flagged limited.
    """
    interview_rows = [r for r in rows
                      if (r.evidence_type or "").startswith(INTERVIEW_PREFIX)
                      and r.source_url]
    if not interview_rows:
        return InterviewDigest(job_id=job_id, state="empty",
                               is_live=is_live, stale=stale)
    by_url: dict[str, list[Evidence]] = {}
    for row in interview_rows:
        by_url.setdefault(normalize_url(row.source_url), []).append(row)
    clusters = _cluster_reports(by_url)
    duplicates_merged = len(by_url) - len(clusters)
    total = len(clusters)
    by_stage: dict[str, list[Evidence]] = {}  # stage -> rows (one per cluster)
    for _url, url_rows in clusters:
        seen_here: set[str] = set()
        for row in url_rows:
            stage = row.evidence_type[len(INTERVIEW_PREFIX):]
            if stage in STAGE_LABELS and stage not in seen_here:
                seen_here.add(stage)
                by_stage.setdefault(stage, []).append(row)
    stages = []
    for stage in sorted(by_stage):
        stage_rows = by_stage[stage]
        # Independent reports = distinct source domains, derived from the
        # ORIGINAL urls (normalized keys carry no scheme for domain parsing).
        domains = {domain_of(r.source_url) for r in stage_rows
                   if domain_of(r.source_url or "")}
        count = len(domains) or len(stage_rows)
        stages.append({
            "stage": stage,
            "label": stage_label(stage),
            "count": count,
            "total": total,
            "anecdotal": count < 2,
        })
    report_dicts = []
    for url, url_rows in clusters:
        first = url_rows[0]
        link = safe_url(first.source_url or "")
        if not link:
            continue  # unrenderable source; counts still reflect stored rows
        url_stages = sorted({r.evidence_type[len(INTERVIEW_PREFIX):]
                             for r in url_rows
                             if r.evidence_type[len(INTERVIEW_PREFIX):] in STAGE_LABELS})
        report_dicts.append({
            "title": first.source_title or "(untitled)",
            "source": domain_of(first.source_url) or "source",
            "url": link,
            "strength": report_strength(link, company_norm or ""),
            "date_display": age_text(first.retrieved_at),
            "stages": url_stages,
        })
    checked = ""
    moments = [r.retrieved_at for r in interview_rows if r.retrieved_at]
    if moments:
        newest = max(moments)
        if newest.tzinfo is None:
            newest = newest.replace(tzinfo=dt.timezone.utc)
        checked = age_text(newest)
    state = "stale" if stale else "ok"
    return InterviewDigest(job_id=job_id, state=state, stages=stages,
                           reports=report_dicts, total_reports=total,
                           duplicates_merged=duplicates_merged, checked=checked,
                           limited=total <= 2, is_live=is_live, stale=stale)


def _cluster_reports(by_url: dict[str, list[Evidence]]) -> list[tuple[str, list[Evidence]]]:
    """Greedy fingerprint clustering over report URLs.

    Returns (representative_url, merged_rows) clusters. Two reports merge
    only when their title+snippet texts are near-identical (>= 0.9), so
    distinct experiences on one domain never collapse together.
    """
    clusters: list[tuple[str, list[Evidence]]] = []
    for url in sorted(by_url):
        rows = by_url[url]
        first = rows[0]
        placed = False
        for index, (rep_url, rep_rows) in enumerate(clusters):
            rep = rep_rows[0]
            similarity = pair_similarity(
                "", first.source_title or "", first.source_snippet or "",
                "", rep.source_title or "", rep.source_snippet or "")
            if similarity >= FINGERPRINT_THRESHOLD:
                merged = list(rep_rows)
                seen = {(r.evidence_type, normalize_url(r.source_url or "")) for r in merged}
                for row in rows:
                    key = (row.evidence_type, normalize_url(row.source_url or ""))
                    if key not in seen:
                        seen.add(key)
                        merged.append(row)
                clusters[index] = (rep_url, merged)
                placed = True
                break
        if not placed:
            clusters.append((url, list(rows)))
    return clusters


def display_dict(digest: InterviewDigest) -> dict:
    """Template-friendly view with per-stage report-count sentences."""
    stages = []
    for entry in digest.stages:
        sentence = (f"{entry['label']} \u2014 reported in {entry['count']} "
                    f"of {entry['total']} available candidate report(s)")
        if entry["anecdotal"]:
            sentence += " (limited reports \u2014 treat as anecdotal)"
        stages.append({**entry, "sentence": sentence})
    return {
        "job_id": digest.job_id,
        "state": digest.state,
        "stages": stages,
        "reports": digest.reports,
        "total_reports": digest.total_reports,
        "duplicates_merged": digest.duplicates_merged,
        "checked": digest.checked,
        "limited": digest.limited,
        "live": digest.is_live,
        "stale": digest.stale,
        "disclaimer": INTERVIEW_DISCLAIMER,
    }


class InterviewService:
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
        self._max_jobs = settings.INTERVIEW_MAX_JOBS if max_jobs is None else max_jobs
        self._ttl = settings.INTERVIEW_TTL_HOURS if ttl_hours is None else ttl_hours
        self._cache = CacheService(db)

    @property
    def max_jobs(self) -> int:
        return self._max_jobs

    def enrich_top(
        self, jobs: list[Job], totals: dict[int, int] | None = None
    ) -> dict[int, InterviewDigest]:
        """Pre-enrich the top-N jobs during search. Bounded, sequential,
        failure-isolated: one job's failure never breaks search."""
        totals = totals or {}
        ranked = sorted(jobs, key=lambda j: totals.get(j.id, 0), reverse=True)
        digests: dict[int, InterviewDigest] = {}
        for job in ranked[: max(0, self._max_jobs)]:
            try:
                digests[job.id] = self.enrich_job(job)
            except Exception:
                logger.exception("interview enrichment failed job=%s", job.id)
                digests[job.id] = InterviewDigest(job_id=job.id, state="unavailable")
        self._db.commit()
        return digests

    def ensure_for_job(self, job: Job) -> InterviewDigest:
        """On-demand refresh for the detail page: fetch only without fresh rows."""
        company = job.company
        company_norm = (company.name_norm if company else "" or "").strip()
        if self._has_fresh_rows(job.id):
            return summarize_reports(job.id, self._interview_rows(job.id),
                                     company_norm=company_norm)
        try:
            return self.enrich_job(job, commit=True)
        except Exception:
            logger.exception("interview on-demand failed job=%s", job.id)
            rows = self._interview_rows(job.id)
            if rows:
                return summarize_reports(job.id, rows, company_norm=company_norm,
                                         stale=True)
            return InterviewDigest(job_id=job.id, state="unavailable")

    def enrich_job(self, job: Job, commit: bool = False) -> InterviewDigest:
        company = job.company
        company_raw = (company.name_raw if company else "").strip()
        company_norm = (company.name_norm if company else "").strip()
        if not company_norm:
            return InterviewDigest(job_id=job.id, state="empty")
        title_part = (job.title_raw or "")[:80]
        queries = [
            f'"{company_raw}" "{title_part}" interview experience',
            f'"{company_raw}" interview process freshers',
        ]
        http_made = False
        used_stale = False
        all_failed = True
        for query in queries:
            body, fresh_http, was_stale = self._fetch(query)
            http_made = http_made or fresh_http
            used_stale = used_stale or was_stale
            if body is None:
                continue
            all_failed = False
            self._store(job, query, body, company_norm)
        self._db.flush()
        if commit:
            self._db.commit()
        rows = self._interview_rows(job.id)
        if not rows and all_failed:
            # SerpApi unreachable and nothing stored: unavailable, not empty.
            return InterviewDigest(job_id=job.id, state="unavailable")
        return summarize_reports(
            job.id, rows, company_norm=company_norm,
            is_live=http_made and not used_stale, stale=used_stale)

    # -- internals -----------------------------------------------------
    def _fetch(self, query: str) -> tuple[dict | None, bool, bool]:
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
                return stale_hit.payload, False, True
            return None, False, False
        self._log_usage(query, "ok", 200, _elapsed_ms(started))
        self._cache.set(ENGINE, params, body, self._ttl)
        self._commit_best_effort()
        return body, True, False

    def _store(self, job: Job, query: str, body: dict, company_norm: str) -> None:
        now = dt.datetime.now(dt.timezone.utc)
        existing = {
            (normalize_url(row.source_url), row.evidence_type): row
            for row in self._interview_rows(job.id)
            if row.source_url
        }
        for result in parse_organic_results(body) or []:
            if not relates_to_company(result.title, result.snippet,
                                      result.link, company_norm):
                continue
            stages = detect_stages(result.title, result.snippet)
            if not stages:
                continue  # not an interview-process report; store nothing
            for stage in stages:
                # Concise factual summary only: stage label + short source
                # title. Never the full review text.
                key = (normalize_url(result.link), f"{INTERVIEW_PREFIX}{stage}")
                row = existing.get(key)
                if row is None:
                    self._db.add(
                        Evidence(
                            job_id=job.id, company_id=job.company_id, engine=ENGINE,
                            query=query, evidence_type=f"{INTERVIEW_PREFIX}{stage}",
                            claim=f"Candidate-reported: {stage_label(stage)} mentioned.",
                            category="context",
                            source_title=result.title[:300], source_url=result.link,
                            source_snippet=result.snippet[:300],
                            retrieved_at=now,
                        )
                    )
                else:
                    row.query = query
                    row.source_title = result.title[:300]
                    row.source_snippet = result.snippet[:300]
                    row.retrieved_at = now
        self._db.flush()

    def _interview_rows(self, job_id: int) -> list[Evidence]:
        return (
            self._db.query(Evidence)
            .filter(Evidence.job_id == job_id)
            .filter(Evidence.evidence_type.startswith(INTERVIEW_PREFIX))
            .order_by(Evidence.retrieved_at.desc())
            .all()
        )

    def _has_fresh_rows(self, job_id: int) -> bool:
        rows = self._interview_rows(job_id)
        if not rows:
            return False
        now = dt.datetime.now(dt.timezone.utc)
        newest = max((r.retrieved_at for r in rows if r.retrieved_at), default=None)
        if newest is None:
            return False
        if newest.tzinfo is None:
            newest = newest.replace(tzinfo=dt.timezone.utc)
        return (now - newest) <= dt.timedelta(hours=self._ttl)

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


def derive_prep_topics(job_description: str, interview_rows: list[Evidence],
                       top_n: int = 6) -> list[dict]:
    """High-frequency prep topics from collected evidence. Pure.

    Counts distinct interview reports mentioning each curated-vocabulary
    skill, plus whether the skill appears in the listing itself. Only
    reported topics are returned — never invented. Study pointers come from
    the static PREP_POINTERS map and are labeled as generic starting points,
    not predictions of what will be asked.
    """
    per_skill_reports: dict[str, set[str]] = {}
    for row in interview_rows or []:
        if not row.source_url:
            continue
        url = normalize_url(row.source_url)
        text = f"{row.source_title or ''} {row.source_snippet or ''}"
        for skill_norm, _ in extract_skills(text):
            per_skill_reports.setdefault(skill_norm, set()).add(url)
    listing_skills = {norm for norm, _ in extract_skills(job_description or "")}
    total = len({normalize_url(r.source_url) for r in (interview_rows or [])
                 if r.source_url})
    topics = []
    for skill_norm, urls in per_skill_reports.items():
        topics.append({
            "skill": skill_norm,
            "label": display_skill(skill_norm),
            "reports": len(urls),
            "total": total,
            "in_listing": skill_norm in listing_skills,
            "pointers": list(PREP_POINTERS.get(skill_norm, [])),
        })
    topics.sort(key=lambda t: (-t["reports"], t["label"]))
    return topics[:max(0, top_n)]
