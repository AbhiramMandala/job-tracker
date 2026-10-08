"""JobNormalizer: SerpApi JobItem -> canonical NormalizedJob.

Pure functions (no DB, no network) so Slice 3 can reuse them unchanged.
Stores both display values and normalized values; normalization never
destroys information, it only adds comparison keys.
"""

import hashlib
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

from app.schemas.jobs import JobItem

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]")


def normalize_company(name: str) -> str:
    text = (name or "").lower().strip()
    text = _PUNCT.sub(" ", text)
    text = _WS.sub(" ", text).strip()
    for token in ("private", "limited", "pvt", "ltd", "inc", "llc"):
        text = re.sub(rf"\b{token}\b", " ", text)
    text = re.sub(r"\btechnolog(?:y|ies)\b", "tech", text)
    text = _WS.sub(" ", text).strip()
    return text.replace(" solutions ", " sol ")


def normalize_title(title: str) -> str:
    text = (title or "").lower()
    text = re.sub(r"\(.*?\)", " ", text)  # drop "(Fresher)" qualifiers from key
    text = re.sub(r"\[.*?\]", " ", text)
    text = _PUNCT.sub(" ", text)
    text = _WS.sub(" ", text).strip()
    text = re.sub(r"\bsr\b", "senior", text)
    text = re.sub(r"\bjr\b", "junior", text)
    return _WS.sub(" ", text).strip()


def normalize_location(location: str) -> str:
    text = (location or "").lower().strip()
    text = _PUNCT.sub(" ", text)
    text = _WS.sub(" ", text).strip()
    text = text.replace("secunderabad", "hyderabad")
    text = re.sub(r"\btelangana\b", "", text)
    text = re.sub(r"\bindia\b", "", text)
    return _WS.sub(" ", text).strip()


def normalize_description(description: str) -> str:
    text = re.sub(r"<[^>]+>", " ", description or "")  # strip HTML tags
    return _WS.sub(" ", text).strip()[:4000]


def apply_domain(link: str) -> str:
    try:
        host = urlparse(link).netloc.lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def make_source_key(
    company_norm: str,
    title_norm: str,
    location_norm: str,
    salary_text: str,
    domain: str,
) -> str:
    """Deterministic identity. URL alone is NOT used (same job, many vias).

    NOTE: upstream `job_id` is deliberately excluded: it is an opaque
    Google-internal token that is absent on some listings and differs
    across query formulations for the same posting. See docs/deduplication.md.
    """
    salary_norm = re.sub(r"\D", "", salary_text or "") or "nosalary"
    raw = "|".join([company_norm, title_norm, location_norm, salary_norm, domain])
    return hashlib.sha256(raw.encode()).hexdigest()


@dataclass
class NormalizedJob:
    title_raw: str = ""
    title_norm: str = ""
    company_raw: str = ""
    company_norm: str = ""
    location_raw: str = ""
    location_norm: str = ""
    description: str = ""
    via: str = ""
    apply_link: str = ""
    posted_text: str = ""
    salary_text: str = ""
    serpapi_job_id: str = ""
    share_link: str = ""
    source_key: str = ""
    via_list: list[str] = field(default_factory=list)


def normalize_job(item: JobItem) -> NormalizedJob:
    company_norm = normalize_company(item.company_name)
    title_norm = normalize_title(item.title)
    location_norm = normalize_location(item.location)
    domain = apply_domain(item.apply_link)
    via_list = [item.via] if item.via else []
    return NormalizedJob(
        title_raw=item.title.strip(),
        title_norm=title_norm,
        company_raw=item.company_name.strip(),
        company_norm=company_norm,
        location_raw=item.location.strip(),
        location_norm=location_norm,
        description=normalize_description(item.description),
        via=item.via,
        apply_link=item.apply_link,
        posted_text=item.posted_at,
        salary_text=item.salary,
        serpapi_job_id=item.job_id,
        share_link=item.share_link,
        source_key=make_source_key(
            company_norm, title_norm, location_norm, item.salary, domain
        ),
        via_list=via_list,
    )
