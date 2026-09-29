"""Company-type estimates from collected evidence. Pure + deterministic.

Deliberately conservative: the evidence JobSetu holds (official-site rows,
corroborating domains) can support "Government / PSU" and a generic
"Established employer" reading, but CANNOT support Startup/MNC/size claims —
so those are never emitted. Anything else is "Unknown" with Low confidence.
Documented trade-off, see docs/interviews.md ("company type" section).
"""

from app.services.evidence import TYPE_WEBSITE
from app.utils import domain_of

GOV_TOKENS = ("government", "ministry", "psu", "municipal", "panchayat",
              "nigam", "pradhikaran")
GOV_DOMAINS = (".gov.in", ".nic.in", ".gov")


def classify_company_type(company_norm: str, company_raw: str,
                          evidences: list) -> dict:
    """Return {"type": ..., "confidence": "High"|"Moderate"|"Low"}.

    Inputs are stored evidence rows (any engine) plus normalized names.
    """
    norm = (company_norm or "").lower()
    tokens = set(norm.split())
    domains = {domain_of(getattr(r, "source_url", "") or "")
               for r in (evidences or [])}
    domains.discard("")
    official = [getattr(r, "source_url", "") for r in (evidences or [])
                if getattr(r, "evidence_type", "") == TYPE_WEBSITE
                and domain_of(getattr(r, "source_url", "") or "")]
    if tokens & set(GOV_TOKENS) or any(
            d in ("gov.in", "nic.in") or d.endswith(GOV_DOMAINS) for d in domains):
        return {"type": "Government / PSU", "confidence": "High"}
    independent = {d for d in domains if d not in {domain_of(u) for u in official}}
    if official and len(independent) >= 3:
        return {"type": "Established employer", "confidence": "Moderate"}
    _ = company_raw  # reserved: name-pattern signals if evidence ever supports them
    return {"type": "Unknown", "confidence": "Low"}


def filter_value(classification: dict) -> str:
    return {"Government / PSU": "government",
            "Established employer": "established"}.get(
        classification.get("type"), "unknown")
