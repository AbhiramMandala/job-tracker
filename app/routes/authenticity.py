"""GET /jobs/{id}/authenticity. Structured authenticity report as JSON.

Read-only over stored evidence rows + job fields. Never calls SerpApi, so it
works identically on live, cached, or stale data and costs no credits.
"""

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Evidence, Job
from app.services.authenticity import analyze_job
from app.services.news import NEWS_TYPE_PREFIX

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/jobs/{job_id}/authenticity")
def job_authenticity(job_id: int, db: Session = Depends(get_db)):
    job = (
        db.query(Job)
        .options(selectinload(Job.company))
        .filter_by(id=job_id)
        .one_or_none()
    )
    if job is None:
        return JSONResponse(
            status_code=404, content={"detail": "Job not found. It may have been removed."}
        )
    rows = db.query(Evidence).filter_by(job_id=job.id).all()
    news_ok = any(
        (r.evidence_type or "").startswith(NEWS_TYPE_PREFIX) and r.source_url
        for r in rows
    )
    return analyze_job(job, rows, news_ok=news_ok).to_dict()
