"""Cross-listing duplicate detection. Pure Python TF-IDF, no sklearn.

Why no sklearn: result sets are tiny (tens of listings), per-search fitting
is trivial, and one less native dependency keeps solo installs reliable.
The math is the documented char-3-gram cosine with 0.5/0.5 title/description
weighting and a company-overlap requirement.
"""

import datetime as dt
import json
import logging
import math
from collections import Counter

from app.models import Job
from app.services.normalizer import NormalizedJob

logger = logging.getLogger(__name__)

SIM_THRESHOLD = 0.82
TITLE_WEIGHT = 0.5
DESC_WEIGHT = 0.5


def _trigrams(text: str) -> Counter:
    padded = f"  {text or ''}  "
    if len(padded) < 3:
        return Counter()
    return Counter(padded[i: i + 3] for i in range(len(padded) - 2))


def _cosine(left: Counter, right: Counter) -> float:
    """Smoothed 2-doc TF-IDF cosine. 1.0 for identical, 0.0 for disjoint."""
    if not left or not right:
        return 0.0
    numerator = 0.0
    norm_l = 0.0
    norm_r = 0.0
    for gram in set(left) | set(right):
        idf = 1.0 + math.log(2.0 / ((gram in left) + (gram in right)))
        wl = left.get(gram, 0) * idf
        wr = right.get(gram, 0) * idf
        numerator += wl * wr
        norm_l += wl * wl
        norm_r += wr * wr
    if norm_l == 0.0 or norm_r == 0.0:
        return 0.0
    return numerator / (math.sqrt(norm_l) * math.sqrt(norm_r))


def pair_similarity(
    a_company: str, a_title: str, a_desc: str,
    b_company: str, b_title: str, b_desc: str,
) -> float:
    title_sim = _cosine(
        _trigrams(f"{a_title} {a_company}"), _trigrams(f"{b_title} {b_company}")
    )
    desc_sim = _cosine(_trigrams(a_desc), _trigrams(b_desc))
    combined = TITLE_WEIGHT * title_sim + DESC_WEIGHT * desc_sim
    return min(1.0, max(0.0, combined))  # clamp float epsilon


def _company_overlap(a_company: str, b_company: str) -> bool:
    if not a_company or not b_company:
        return False  # no fuzzy merge without company agreement
    return bool(set(a_company.split()) & set(b_company.split()))


def is_duplicate_norms(a: NormalizedJob, b: NormalizedJob) -> bool:
    """Duplicate verdict for two normalized listings (new vs new)."""
    if a.source_key == b.source_key:
        return True
    if not _company_overlap(a.company_norm, b.company_norm):
        return False
    return (
        pair_similarity(
            a.company_norm, a.title_norm, a.description,
            b.company_norm, b.title_norm, b.description,
        )
        >= SIM_THRESHOLD
    )


def is_duplicate_job(norm: NormalizedJob, job: Job, company_norm: str) -> bool:
    """Duplicate verdict for a normalized listing vs a persisted canonical."""
    if norm.source_key == job.source_key:
        return True
    if not _company_overlap(norm.company_norm, company_norm):
        return False
    return (
        pair_similarity(
            norm.company_norm, norm.title_norm, norm.description,
            company_norm, job.title_norm or "", job.description or "",
        )
        >= SIM_THRESHOLD
    )


def _aware(value: dt.datetime) -> dt.datetime:
    # SQLite round-trips datetimes as naive; normalize before comparing.
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value


def apply_merge(job: Job, norm: NormalizedJob, seen_at) -> None:
    """Fold a duplicate listing into its canonical job. Keeps the best of both."""
    job.last_seen = max(_aware(job.last_seen), _aware(seen_at))
    job.dup_count = (job.dup_count or 0) + 1
    if len(norm.description) > len(job.description or ""):
        job.description = norm.description
    if norm.salary_text and not job.salary_text:
        job.salary_text = norm.salary_text
    if norm.posted_text and not job.posted_text:
        job.posted_text = norm.posted_text
    if norm.apply_link and not job.apply_link:
        job.apply_link = norm.apply_link
    if norm.serpapi_job_id and not job.serpapi_job_id:
        job.serpapi_job_id = norm.serpapi_job_id
    try:
        sources = json.loads(job.via or "[]")
    except ValueError:
        sources = []
    for source in norm.via_list:
        if source and source not in sources:
            sources.append(source)
    job.via = json.dumps(sources)
    try:
        extra = json.loads(job.extra_links or "[]")
    except ValueError:
        extra = []
    if norm.apply_link and norm.apply_link != job.apply_link and all(
        not isinstance(e, dict) or e.get("link") != norm.apply_link for e in extra
    ):
        extra.append(
            {"source": norm.via_list[0] if norm.via_list else "listing",
             "link": norm.apply_link}
        )
    job.extra_links = json.dumps(extra)
    logger.debug("merged duplicate into job id=%s key=%s", job.id, job.source_key[:12])
