"""Company-type estimates from collected evidence. Pure + deterministic.

Deliberately conservative: the evidence JobSetu holds (official-site rows,
corroborating domains) can support "Government / PSU" and a generic
"Established employer" reading, but CANNOT support Startup/MNC/size claims —
so those are never emitted.

Fallback honesty model (see docs/interviews.md, "company type" section):
listings that match no specific rule fall back to user-facing
"Private Company" with Low confidence and an explicit insufficient-evidence
basis — never a confident ownership claim. There is no separate hidden enum:
"Private Company" IS the canonical internal value, and `normalize_company_type`
is the single layer that maps any variant spelling to canonical form.
"""

import re

from app.services.evidence import TYPE_WEBSITE
from app.utils import domain_of

GOV_TOKENS = ("government", "ministry", "psu", "municipal", "panchayat",
              "nigam", "pradhikaran")
GOV_DOMAINS = (".gov.in", ".nic.in", ".gov")

TYPE_GOVERNMENT = "Government / PSU"
TYPE_ESTABLISHED = "Established employer"
TYPE_PRIVATE = "Private Company"

_CANONICAL = {
    "government / psu": (TYPE_GOVERNMENT, "government"),
    "established employer": (TYPE_ESTABLISHED, "established"),
    "private company": (TYPE_PRIVATE, "private"),
}


def _key(value: object) -> str:
    return re.sub(r"[\s_]+", " ", str(value or "").strip().lower())


def normalize_company_type(value: object) -> dict:
    """Map any spelling variant to canonical {"type": ..., "filter": ...}.

    Unknown inputs fall back to Private Company — the UI has no Unknown
    option by design, so normalization must be total.
    """
    label, slug = _CANONICAL.get(_key(value), (TYPE_PRIVATE, "private"))
    return {"type": label, "filter": slug}


def classify_company_type(company_norm: str, company_raw: str,
                          evidences: list) -> dict:
    """Return {"type": ..., "confidence": "High"|"Moderate"|"Low",
    "basis": ...}.

    Inputs are stored evidence rows (any engine) plus normalized names.
    The basis string names the evidence behind the label so the UI can show
    *why*, not just *what*.
    """
    norm = (company_norm or "").lower()
    tokens = set(norm.split())
    domains = {domain_of(getattr(r, "source_url", "") or "")
               for r in (evidences or [])}
    domains.discard("")
    official = [getattr(r, "source_url", "") for r in (evidences or [])
                if getattr(r, "evidence_type", "") == TYPE_WEBSITE
                and domain_of(getattr(r, "source_url", "") or "")]
    gov_token_hit = sorted(tokens & set(GOV_TOKENS))
    gov_domain_hit = sorted(d for d in domains
                            if d in ("gov.in", "nic.in") or d.endswith(GOV_DOMAINS))
    if gov_token_hit or gov_domain_hit:
        why = gov_token_hit + gov_domain_hit
        return {"type": TYPE_GOVERNMENT, "confidence": "High",
                "basis": "government indicators: " + ", ".join(why[:3])}
    independent = {d for d in domains if d not in {domain_of(u) for u in official}}
    if official and len(independent) >= 3:
        return {"type": TYPE_ESTABLISHED, "confidence": "Moderate",
                "basis": f"official site + {len(independent)} corroborating domains"}
    _ = company_raw  # reserved: name-pattern signals if evidence ever supports them
    return {"type": TYPE_PRIVATE, "confidence": "Low",
            "basis": "insufficient evidence for a specific type; "
                     "private-sector default, not verified"}


def filter_value(classification: dict) -> str:
    return normalize_company_type((classification or {}).get("type"))["filter"]
