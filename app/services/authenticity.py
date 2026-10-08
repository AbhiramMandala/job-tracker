"""Authenticity analyzer: evidence-based job-risk signals. Pure + deterministic.

NOT a scam detector. Produces an Authenticity Evidence Score (0-100) from
ALREADY-STORED SerpApi evidence rows plus the job's own fields. Makes ZERO
SerpApi calls and touches no DB, so it works identically on live, cached, or
stale data and costs no credits.

Category weights are documented judgment calls, NOT statistically validated
probabilities — see docs/authenticity.md. Wording never claims a job is
real/fake, legitimate/fraudulent, or guaranteed anything.
"""

from dataclasses import dataclass, field

from app.models import Evidence, Job
from app.services.evidence import (
    TYPE_COMPANY,
    TYPE_JOB,
    TYPE_LOCATION,
    TYPE_WARNING,
    TYPE_WEBSITE,
)
from app.services.news import NEWS_TYPE_PREFIX
from app.utils import domain_of, normalize_url, official_site_match

DISCLAIMER = (
    "This score is an evidence-based risk indicator, not a guarantee that "
    "a job is legitimate or fraudulent. Always verify the employer and "
    "application channel before sharing sensitive information or making payments."
)

MAX_COMPANY = 25
MAX_CONSISTENCY = 25
MAX_APPLICATION = 20
MAX_CONTENT = 20
MAX_EVIDENCE = 10
NO_EVIDENCE_CAP = 49  # without independent evidence, confidence is capped

# Recognized recruiting platforms (apply-link channel check).
KNOWN_PLATFORMS = (
    "linkedin.com", "indeed.com", "naukri.com", "shine.com",
    "foundit.in", "foundit.com", "timesjobs.com", "apna.co",
    "iimjobs.com", "cutshort.io",
)

FREE_EMAIL_DOMAINS = (
    "gmail.com", "yahoo.com", "yahoo.in", "hotmail.com", "outlook.com",
    "rediffmail.com", "protonmail.com", "icloud.com", "aol.com",
)

# Keyword heuristics over listing text. English-only, documented in
# docs/authenticity.md. Signals, never proof.
FEE_PHRASES = (
    "registration fee", "registration charges", "security deposit",
    "equipment deposit", "training fee", "training charges",
    "application fee", "pay to apply", "refundable deposit",
    "cryptocurrency", "pay in crypto",
)
GUARANTEE_PHRASES = (
    "guaranteed income", "guaranteed earning", "guaranteed salary",
    "assured income", "earn \u20b9", "earn rs",
)
NO_INTERVIEW_PHRASES = (
    "no interview", "without interview", "without any interview",
)
URGENCY_PHRASES = (
    "urgent", "immediately", "immediate joining", "limited slots",
    "act fast", "apply immediately", "today only",
)

LEVELS = (
    (90, "strong", "Strong supporting evidence"),
    (75, "higher", "Higher confidence"),
    (50, "mixed", "Mixed evidence \u2014 verify"),
    (25, "significant", "Significant risk signals"),
    (0, "high", "High risk \u2014 verify carefully"),
)

CATEGORY_LABELS = (
    ("company_verification", "Company verification", MAX_COMPANY),
    ("job_consistency", "Job consistency", MAX_CONSISTENCY),
    ("application_signals", "Application signals", MAX_APPLICATION),
    ("content_risk", "Content risk", MAX_CONTENT),
    ("independent_evidence", "Independent evidence", MAX_EVIDENCE),
)


def display_dict(report: "AuthenticityReport") -> dict:
    """Template-friendly view of a report (same numbers as to_dict)."""
    return {
        "job_id": report.job_id,
        "score": report.score,
        "level": report.level,
        "level_label": report.level_label,
        "categories": [
            {"name": label, "got": report.category_scores.get(key, 0), "max": maximum}
            for key, label, maximum in CATEGORY_LABELS
        ],
        "signals": [{"kind": s.kind, "text": s.text} for s in report.signals],
        "contradictions": list(report.contradictions),
        "available": report.evidence_available,
        "disclaimer": report.disclaimer,
    }


def level_for(score: int) -> tuple[str, str]:
    for floor, level, label in LEVELS:
        if score >= floor:
            return level, label
    return "high", "High risk \u2014 verify carefully"  # unreachable; clamp guards


@dataclass
class Signal:
    kind: str  # "support" | "caution" | "notice"
    text: str


@dataclass
class AuthenticityReport:
    job_id: int
    score: int
    level: str
    level_label: str
    category_scores: dict[str, int] = field(default_factory=dict)
    signals: list[Signal] = field(default_factory=list)
    contradictions: list[str] = field(default_factory=list)
    evidence_available: bool = False
    disclaimer: str = DISCLAIMER

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "level": self.level,
            "level_label": self.level_label,
            "category_scores": dict(self.category_scores),
            "signals": [{"kind": s.kind, "text": s.text} for s in self.signals],
            "contradictions": list(self.contradictions),
            "evidence_available": self.evidence_available,
            "disclaimer": self.disclaimer,
        }


def analyze_job(job: Job, evidences: list[Evidence], news_ok: bool = False) -> AuthenticityReport:
    """Score one job. Pure function: same inputs always give the same report."""
    rows = [r for r in (evidences or [])
            if not (r.evidence_type or "").startswith(NEWS_TYPE_PREFIX)]
    supporting = [r for r in rows if r.category == "supporting"]
    company = job.company
    company_raw = (company.name_raw if company else "" or "").strip()
    company_norm = (company.name_norm if company else "" or "").strip()

    signals: list[Signal] = []
    contradictions: list[str] = []

    # -- A. company verification /25 ------------------------------------
    company_pts = 0
    website_rows = [r for r in rows if r.evidence_type == TYPE_WEBSITE]
    if website_rows:
        company_pts += 10
        signals.append(Signal("support", "Official company domain found in search results."))
    presence = [r for r in rows
                if r.evidence_type in (TYPE_COMPANY, TYPE_JOB)
                and r.category == "supporting"]
    if presence:
        company_pts += 8
        signals.append(Signal(
            "support",
            f"Company independently found in {len(presence)} supporting result(s)."))
    job_rows = [r for r in rows
                if r.evidence_type == TYPE_JOB and r.category == "supporting"]
    if job_rows:
        company_pts += 4
        signals.append(Signal("support", "Search results connect the company to this role."))
    loc_rows = [r for r in rows
                if r.evidence_type == TYPE_LOCATION and r.category == "supporting"]
    if loc_rows:
        company_pts += 3
        signals.append(Signal("support", "Location presence supported by search results."))
    if not company_norm:
        signals.append(Signal(
            "caution", "Company could not be independently verified \u2014 "
                       "the listing provides no company information to check."))
    company_pts = min(MAX_COMPANY, company_pts)

    # -- B. job-post consistency /25 ------------------------------------
    consistency_pts = 0
    if job_rows:
        consistency_pts += 10
    if loc_rows:
        consistency_pts += 6
    if [r for r in rows
            if r.evidence_type == TYPE_COMPANY and r.category == "supporting"]:
        consistency_pts += 5
    domains = {domain_of(r.source_url) for r in supporting if domain_of(r.source_url)}
    official = {domain_of(r.source_url) for r in website_rows if domain_of(r.source_url)}
    independent = domains - official
    if len(independent) >= 3:
        consistency_pts += 4
        signals.append(Signal(
            "support",
            f"Job information corroborated across {len(independent)} independent sites."))
    city = (job.location_raw or "").split(",")[0].strip()
    if city and rows and not loc_rows:
        contradictions.append(
            f"Location ({city}) could not be independently confirmed.")
        consistency_pts -= 3
    if len(domains) >= 4 and not website_rows and len(supporting) >= 2:
        contradictions.append(
            "Ambiguous identity \u2014 several distinct sites use this company name.")
        consistency_pts -= 3
    for row in rows:
        if row.evidence_type == TYPE_WARNING and row.claim:
            claim = row.claim
            if claim not in contradictions:
                contradictions.append(claim)
                consistency_pts -= 3
    consistency_pts = max(0, min(MAX_CONSISTENCY, consistency_pts))

    # -- C. application/contact signals: base 12, positives to 20 -------
    application_pts = 12
    apply_link = (job.apply_link or "").strip()
    apply_domain = domain_of(apply_link)
    official_domains = {d for d in official if d}
    if apply_domain and (apply_domain in official_domains
                         or official_site_match(company_norm, apply_link)):
        application_pts += 5
        signals.append(Signal(
            "support", "Application link points to the employer's official domain."))
    elif apply_domain and any(apply_domain == p or apply_domain.endswith("." + p)
                              for p in KNOWN_PLATFORMS):
        application_pts += 3
        signals.append(Signal(
            "support",
            f"Application via recognized recruiting platform ({apply_domain})."))
    elif apply_domain:
        contradictions.append(
            "Application channel has no clear link to the employer \u2014 "
            "verify where the link leads before applying.")
        application_pts -= 4
    else:
        signals.append(Signal("notice", "No application link provided."))
        application_pts -= 2
    text = f"{job.description or ''} {job.title_raw or ''}".lower()
    if any(f"@{d}" in text for d in FREE_EMAIL_DOMAINS):
        contradictions.append(
            "Recruiter contact uses a free email address \u2014 verify the sender "
            "through an official channel. This alone does not prove fraud.")
        application_pts -= 4
    if "whatsapp" in text:
        contradictions.append(
            "Listing directs applicants to WhatsApp \u2014 verify the recruiter "
            "independently before sharing information.")
        application_pts -= 5
    if "telegram" in text:
        contradictions.append(
            "Listing directs applicants to Telegram \u2014 verify the recruiter "
            "independently before sharing information.")
        application_pts -= 5
    application_pts = max(0, min(MAX_APPLICATION, application_pts))

    # -- D. job-content risk: start 20, subtract -------------------------
    content_pts = MAX_CONTENT
    fee_hit = next((p for p in FEE_PHRASES if p in text), "")
    if fee_hit:
        contradictions.append(
            f"Listing mentions \u2018{fee_hit}\u2019 \u2014 legitimate employers "
            "rarely charge candidates to apply.")
        content_pts -= 6
    if any(p in text for p in GUARANTEE_PHRASES) or (
            "earn" in text and ("per day" in text or "per week" in text)):
        contradictions.append(
            "Listing promises guaranteed income \u2014 treat earnings claims "
            "with skepticism.")
        content_pts -= 5
    if any(p in text for p in NO_INTERVIEW_PHRASES):
        contradictions.append("Listing claims no interview is needed.")
        content_pts -= 4
    if sum(1 for p in URGENCY_PHRASES if p in text) >= 2:
        signals.append(Signal("caution", "Excessive urgency language."))
        content_pts -= 2
    salary_text = (job.salary_text or "").lower()
    if any(tok in salary_text for tok in ("lakh", "crore", "$", "dollar", "usd")):
        contradictions.append("Salary claim requires additional verification.")
        content_pts -= 3
    content_pts = max(0, min(MAX_CONTENT, content_pts))

    # -- E. independent evidence /10 ------------------------------------
    sources = {normalize_url(r.source_url) for r in supporting if r.source_url}
    if len(sources) >= 3:
        evidence_pts = 10
        signals.append(Signal("support", f"{len(sources)} independent supporting sources."))
    elif len(sources) == 2:
        evidence_pts = 7
        signals.append(Signal("support", "2 independent supporting sources."))
    elif len(sources) == 1:
        evidence_pts = 4
        signals.append(Signal("notice", "Only one independent supporting source."))
    else:
        evidence_pts = 0
        signals.append(Signal("notice", "Limited independent evidence."))
    if news_ok:
        evidence_pts = min(MAX_EVIDENCE, evidence_pts + 2)
        signals.append(Signal("support", "Recent news context available for this company."))
    evidence_pts = max(0, min(MAX_EVIDENCE, evidence_pts))

    available = bool(rows)
    total = company_pts + consistency_pts + application_pts + content_pts + evidence_pts
    if not available:
        total = min(total, NO_EVIDENCE_CAP)
        signals.append(Signal(
            "notice",
            "Insufficient independent evidence \u2014 this score reflects "
            "job-content signals only and is capped until evidence exists."))
    total = max(0, min(100, total))
    level, level_label = level_for(total)

    return AuthenticityReport(
        job_id=job.id,
        score=total,
        level=level,
        level_label=level_label,
        category_scores={
            "company_verification": company_pts,
            "job_consistency": consistency_pts,
            "application_signals": application_pts,
            "content_risk": content_pts,
            "independent_evidence": evidence_pts,
        },
        signals=signals,
        contradictions=contradictions,
        evidence_available=available,
    )
