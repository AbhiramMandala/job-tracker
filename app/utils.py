"""Small shared presentation helpers (no business logic)."""

import datetime as dt

from urllib.parse import urlparse


def age_text(moment: dt.datetime | None) -> str:
    if moment is None:
        return "unknown time"
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=dt.timezone.utc)
    seconds = max(0, int((dt.datetime.now(dt.timezone.utc) - moment).total_seconds()))
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    hours = minutes // 60
    if hours < 48:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days != 1 else ''} ago"


def safe_url(link: str) -> str:
    """Return the link only if it is an http(s) URL, else empty string."""
    try:
        parts = urlparse((link or "").strip())
    except ValueError:
        return ""
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return ""
    return parts.geturl()


def domain_of(link: str) -> str:
    """Registrable-ish domain, lowercased, www stripped. Empty when unusable."""
    try:
        host = urlparse((link or "").strip().lower()).netloc
    except ValueError:
        return ""
    host = host.split("@")[-1].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def official_site_match(company_norm: str, link: str) -> bool:
    """Heuristic: does this link look like the company's own site?

    True when the domain's first label contains (nearly) all substantive
    company tokens — e.g. tokens {acme, tech} in "acmetechnologies".
    Single-token names need only that token. This keeps "acme-foods.com"
    (a different company sharing one word) from counting as the official
    site of "Acme Tech". Documented heuristic — evidence, not proof.
    """
    domain = domain_of(link)
    if not domain or not company_norm:
        return False
    label = domain.split(".")[0]
    tokens = [t for t in company_norm.split() if len(t) >= 3]
    if not tokens:
        return False
    needed = min(2, len(tokens))
    return sum(1 for t in tokens if t in label) >= needed


def normalize_url(link: str) -> str:
    """Identity key for evidence dedup: host + path, lowercased, no tracking."""
    try:
        parts = urlparse((link or "").strip().lower())
    except ValueError:
        return (link or "").strip().lower()
    host = parts.netloc.split("@")[-1].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    path = parts.path.rstrip("/") or "/"
    return f"{host}{path}"
