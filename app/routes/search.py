"""POST /search. Thin route: validate form, call services, render."""

import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.data.skills import display_skill
from app.database import get_db
from app.models import Evidence, JobSkill, Match
from app.routes.profile import get_active_candidate
from app.services.authenticity import analyze_job, display_dict
from app.services.company import classify_company_type, filter_value
from app.services.evidence import EvidenceService, STATUS_SUPPORTING, STATUS_WARNING
from app.services.interview import InterviewService, display_dict as interview_display_dict
from app.services.job_search import JobSearchService
from app.services.news import NewsService
from app.services.serpapi_client import SerpApiError
from app.utils import age_text, safe_url

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory="app/templates")
router = APIRouter()

_FRIENDLY = {
    "config": "Job search is not configured yet (missing API key). Please try again later.",
    "auth": "Job search is temporarily unavailable. Please try again.",
    "rate_limit": "Job search is busy right now. Please try again in a while.",
    "timeout": "Job search is temporarily unavailable. Please try again.",
    "http": "Job search is temporarily unavailable. Please try again.",
    "parse": "Job search returned an unexpected response. Please try again.",
}


@router.post("/search", response_class=HTMLResponse)
async def run_search(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    role = str(form.get("role") or "")
    location = str(form.get("location") or "")
    experience = str(form.get("experience") or "Fresher")
    try:
        result = JobSearchService(db).run(role, location, experience)
    except ValueError as exc:
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "role": role or "Python Backend Developer",
                "location": location or "Hyderabad",
                "experience": experience,
                "search_available": True,
                "error": str(exc),
            },
            status_code=400,
        )
    except SerpApiError as exc:
        logger.warning("search failed kind=%s q=%r", exc.kind, role)
        return templates.TemplateResponse(
            request,
            "error.html",
            {"message": _FRIENDLY.get(exc.kind, _FRIENDLY["http"])},
            status_code=503,
        )
    candidate = get_active_candidate(db)
    job_ids = [job.id for job in result.jobs]
    matches: dict[int, Match] = {}
    skills_by_job: dict[int, list[str]] = {}
    if job_ids:
        for row in db.query(Match).filter(Match.job_id.in_(job_ids)).all():
            if candidate is not None and row.candidate_id == candidate.id:
                matches[row.job_id] = row
        for row in (
            db.query(JobSkill)
            .filter(JobSkill.job_id.in_(job_ids))
            .order_by(JobSkill.id)
            .all()
        ):
            skills_by_job.setdefault(row.job_id, []).append(row.skill_norm)
    gap_display = [
        {
            "skill": display_skill(gap["skill"]),
            "missing_in": gap["missing_in"],
            "total_jobs": gap["total_jobs"],
        }
        for gap in result.gaps
    ]
    # VERIFY pillar: enrich top jobs by match score (or result order).
    totals = {job_id: match.total for job_id, match in matches.items()}
    verify = EvidenceService(db).enrich(result.jobs, totals or None)
    # NEWS CONTEXT: pre-enrich a smaller top-N; failures never break search.
    try:
        news_digests = NewsService(db).enrich_top(result.jobs, totals or None)
    except Exception:
        logger.exception("news pre-enrichment failed; continuing without news")
        news_digests = {}
    # INTERVIEW CONTEXT: pre-enrich a smaller top-N; failures never break search.
    try:
        interview_digests = InterviewService(db).enrich_top(result.jobs, totals or None)
    except Exception:
        logger.exception("interview pre-enrichment failed; continuing without it")
        interview_digests = {}
    interview_display = {
        job_id: interview_display_dict(digest)
        for job_id, digest in interview_digests.items()
    }
    verify_display = {}
    for job_id, summary in verify.items():
        verify_display[job_id] = {
            "status": summary.status,
            "label": _verify_label(summary.status),
            "reasons": summary.reasons,
            "source_count": summary.source_count,
            "age": age_text(summary.retrieved_at),
            "live": summary.is_live,
            "stale": summary.stale,
            "is_supporting": summary.status == STATUS_SUPPORTING,
            "is_warning": summary.status == STATUS_WARNING,
        }
    extra_links: dict[int, list[dict]] = {}
    for job in result.jobs:
        try:
            links = json.loads(job.extra_links or "[]")
        except ValueError:
            links = []
        extra_links[job.id] = [
            {"source": e.get("source", "listing"), "url": safe_url(e.get("link", ""))}
            for e in links
            if isinstance(e, dict) and safe_url(e.get("link", ""))
        ][:3]
    news_display = {}
    for job_id, digest in news_digests.items():
        news_display[job_id] = {
            "state": digest.state,
            "items": digest.items[:2],
            "live": digest.is_live,
            "stale": digest.stale,
        }
    # AUTHENTICITY: pure derivation over stored rows + job fields. One bounded
    # query, zero SerpApi calls, never blocks or breaks search.
    auth_display: dict[int, dict] = {}
    auth_by_job: dict[int, list] = {}
    if job_ids:
        try:
            auth_rows = db.query(Evidence).filter(Evidence.job_id.in_(job_ids)).all()
        except Exception:
            logger.exception("authenticity evidence lookup failed; continuing")
            auth_rows = []
        for row in auth_rows:
            auth_by_job.setdefault(row.job_id, []).append(row)
        for job in result.jobs:
            rows = auth_by_job.get(job.id, [])
            news_ok = any(
                (r.evidence_type or "").startswith("news_") and r.source_url
                for r in rows
            )
            try:
                auth_display[job.id] = display_dict(analyze_job(job, rows, news_ok=news_ok))
            except Exception:
                logger.exception("authenticity analysis failed job=%s", job.id)
    # COMPANY TYPE: evidence-based estimate per card (pure, same rows).
    company_display: dict[int, dict] = {}
    if job_ids:
        for job in result.jobs:
            company = job.company
            try:
                classification = classify_company_type(
                    company.name_norm if company else "",
                    company.name_raw if company else "",
                    auth_by_job.get(job.id, []) if job_ids else [],
                )
            except Exception:
                logger.exception("company classification failed job=%s", job.id)
                classification = {"type": "Unknown", "confidence": "Low"}
            company_display[job.id] = {
                "type": classification["type"],
                "confidence": classification["confidence"],
                "filter": filter_value(classification),
            }
    return templates.TemplateResponse(
        request,
        "results.html",
        {
            "role": result.search.role,
            "location": result.search.location,
            "experience": result.search.experience,
            "jobs": result.jobs,
            "raw_count": result.raw_count,
            "canonical_count": result.canonical_count,
            "dup_removed": result.dup_removed,
            "is_live": result.is_live,
            "stale": result.stale,
            "age": age_text(result.search.retrieved_at),
            "has_profile": result.has_profile,
            "matches": matches,
            "skills_by_job": skills_by_job,
            "gaps": gap_display,
            "display_skill": display_skill,
            "verify": verify_display,
            "safe_url": safe_url,
            "extra_links": extra_links,
            "news": news_display,
            "authenticity": auth_display,
            "interview": interview_display,
            "company": company_display,
        },
    )


def _verify_label(status: str) -> str:
    return {
        "supporting": "Supporting evidence",
        "needs_verification": "Needs verification",
        "warning": "Warning signals",
        "unavailable": "Verification unavailable",
    }.get(status, "Verification unavailable")
