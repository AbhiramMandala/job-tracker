"""GET /jobs/{id}/evidence. Read-only detail view over stored evidence."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.data.skills import display_skill
from app.models import Evidence, Job, JobSkill
from app.services.company import classify_company_type
from app.services.interview import (
    derive_prep_topics,
    display_dict as interview_display_dict,
    summarize_reports as summarize_interview_reports,
)
from app.services.authenticity import analyze_job, display_dict
from app.services.news import NewsService
from app.utils import age_text, domain_of, safe_url

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory="app/templates")
router = APIRouter()


@router.get("/jobs/{job_id}/evidence", response_class=HTMLResponse)
def job_evidence(request: Request, job_id: int, db: Session = Depends(get_db)):
    job = (
        db.query(Job)
        .options(selectinload(Job.company))
        .filter_by(id=job_id)
        .one_or_none()
    )
    if job is None:
        return templates.TemplateResponse(
            request, "error.html",
            {"message": "Job not found. It may have been removed."},
            status_code=404,
        )
    rows = (
        db.query(Evidence)
        .filter_by(job_id=job.id)
        .order_by(Evidence.retrieved_at.desc())
        .all()
    )
    verify_rows = [r for r in rows if not r.evidence_type.startswith("news_")]
    try:
        news_digest = NewsService(db).ensure_for_job(job)
    except Exception:
        logger.exception("news on-demand failed job=%s", job.id)
        news_digest = None
    sources = [
        {
            "query": row.query,
            "engine": row.engine,
            "type": row.evidence_type,
            "category": row.category,
            "title": row.source_title or "(untitled result)",
            "url": safe_url(row.source_url),
            "domain": domain_of(row.source_url) or "(no link)",
            "snippet": row.source_snippet,
            "age": age_text(row.retrieved_at),
        }
        for row in verify_rows
        if row.evidence_type != "warning_signal" or row.claim
    ]
    warnings = [r for r in verify_rows if r.category == "warning"]
    company = job.company
    classification = classify_company_type(
        company.name_norm if company else "",
        company.name_raw if company else "",
        rows,
    )
    official_site = ""
    for row in verify_rows:
        if row.evidence_type == "company_website" and safe_url(row.source_url):
            official_site = safe_url(row.source_url)
            break
    job_skills = [
        r.skill_norm for r in db.query(JobSkill).filter_by(job_id=job.id)
        .order_by(JobSkill.id).all()
    ]
    job_skill_labels = [display_skill(s) for s in job_skills]
    interview_only = [r for r in rows if (r.evidence_type or "").startswith("interview_")]
    prep_topics = derive_prep_topics(job.description or "", interview_only)
    news_items = []
    news_state = "unavailable"
    news_stale = False
    if news_digest is not None:
        news_state = news_digest.state
        news_stale = news_digest.stale
        news_items = [
            {
                "title": item["title"],
                "source": item["source"],
                "url": safe_url(item["url"]),
                "date_display": item["date_display"],
                "label": item["label"],
                "attention": item["attention"],
            }
            for item in news_digest.items
            if safe_url(item["url"])
        ]
    return templates.TemplateResponse(
        request, "evidence.html",
        {
            "job": job,
            "company_name": job.company.name_raw if job.company else "Unknown company",
            "sources": [s for s in sources if s["url"]],
            "notices": [w.claim for w in warnings],
            "has_evidence": bool(verify_rows),
            "news_items": news_items,
            "news_state": news_state,
            "news_stale": news_stale,
            "iv": interview_display_dict(summarize_interview_reports(job.id, rows)),
            "company_type": classification["type"],
            "company_confidence": classification["confidence"],
            "official_site": official_site,
            "job_skills": job_skills,
            "job_skill_labels": job_skill_labels,
            "prep_topics": prep_topics,
            "auth": display_dict(
                analyze_job(job, rows, news_ok=bool(news_items))
            ),
        },
    )
