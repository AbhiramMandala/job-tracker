"""Progressive enrichment API. Powers the results page's async panels.

POST /search returns fast job cards with loading placeholders; the page then
fetches each section here in parallel. Every endpoint is cache-first through
the existing services, honors the existing top-N caps, never raises on
enrichment failure (unavailable states render instead), and makes no more
SerpApi calls than the old blocking flow did.

GET /api/enrich/{verify,news,interview}?search_id=N
  -> {"search_id": N, "kind": ..., "items": {job_id: html},
      "timings_ms": {...}, "unavailable": [job_id, ...]}
"""

import logging
import time

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Job, Match, Search
from app.routes.profile import get_active_candidate
from app.services.evidence import EvidenceService, STATUS_SUPPORTING, STATUS_WARNING
from app.services.interview import InterviewService, display_dict as interview_display_dict
from app.services.news import NewsService
from app.utils import age_text

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory="app/templates")
router = APIRouter()

KINDS = ("verify", "news", "interview")


def _jobs_for_search(db: Session, search_id: int) -> list[Job]:
    return (
        db.query(Job)
        .options(selectinload(Job.company))
        .filter(Job.search_id == search_id, Job.is_active == True)  # noqa: E712
        .all()
    )


def _totals(db: Session, jobs: list[Job]) -> dict[int, int]:
    candidate = get_active_candidate(db)
    if candidate is None:
        return {}
    ids = [job.id for job in jobs]
    if not ids:
        return {}
    return {
        row.job_id: row.total
        for row in db.query(Match).filter(
            Match.job_id.in_(ids), Match.candidate_id == candidate.id
        ).all()
    }


def _verify_label(status: str) -> str:
    return {
        "supporting": "Supporting evidence",
        "needs_verification": "Needs verification",
        "warning": "Warning signals",
        "unavailable": "Verification unavailable",
    }.get(status, "Verification unavailable")


def _render_verify(db: Session, jobs: list[Job], totals: dict) -> tuple[dict, dict, dict]:
    started = time.monotonic()
    try:
        summaries = EvidenceService(db).enrich(jobs, totals or None)
    except Exception:
        logger.exception("enrich verify failed")
        summaries = {}
    items: dict[str, str] = {}
    statuses: dict[str, str] = {}
    for job_id, summary in summaries.items():
        statuses[str(job_id)] = summary.status
        ver = {
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
        items[str(job_id)] = templates.get_template("_verify_panel.html").render(
            {"ver": ver, "job_id": job_id}
        )
    ms = int((time.monotonic() - started) * 1000)
    return items, {"verify_ms": ms}, statuses


def _render_news(db: Session, jobs: list[Job], totals: dict) -> tuple[dict, dict, dict]:
    started = time.monotonic()
    try:
        digests = NewsService(db).enrich_top(jobs, totals or None)
    except Exception:
        logger.exception("enrich news failed")
        digests = {}
    items: dict[str, str] = {}
    for job_id, digest in digests.items():
        nw = {
            "state": digest.state,
            "items": digest.items[:2],
            "live": digest.is_live,
            "stale": digest.stale,
        }
        items[str(job_id)] = templates.get_template("_news_panel.html").render(
            {"nw": nw, "job_id": job_id}
        )
    ms = int((time.monotonic() - started) * 1000)
    return items, {"news_ms": ms}, {}


def _render_interview(db: Session, jobs: list[Job], totals: dict) -> tuple[dict, dict, dict]:
    started = time.monotonic()
    try:
        digests = InterviewService(db).enrich_top(jobs, totals or None)
    except Exception:
        logger.exception("enrich interview failed")
        digests = {}
    items: dict[str, str] = {}
    for job_id, digest in digests.items():
        iv = interview_display_dict(digest)
        items[str(job_id)] = templates.get_template("_interview.html").render({"iv": iv})
    ms = int((time.monotonic() - started) * 1000)
    return items, {"interview_ms": ms}, {}


_RENDERERS = {"verify": _render_verify, "news": _render_news, "interview": _render_interview}


@router.get("/api/enrich/{kind}")
def enrich_section(kind: str, search_id: int, db: Session = Depends(get_db)):
    if kind not in _RENDERERS:
        return JSONResponse(status_code=404, content={"detail": "Unknown enrichment section."})
    search = db.query(Search).filter_by(id=search_id).one_or_none()
    if search is None:
        return JSONResponse(status_code=404, content={"detail": "Search not found."})
    jobs = _jobs_for_search(db, search_id)
    totals = _totals(db, jobs)
    started = time.monotonic()
    items, timings, extra = _RENDERERS[kind](db, jobs, totals)
    timings["total_ms"] = int((time.monotonic() - started) * 1000)
    logger.info("enrich kind=%s search_id=%d jobs=%d items=%d ms=%d",
                kind, search_id, len(jobs), len(items), timings["total_ms"])
    body = {
        "search_id": search_id,
        "kind": kind,
        "items": items,
        "timings_ms": timings,
    }
    if extra:
        body["statuses"] = extra
    return body
