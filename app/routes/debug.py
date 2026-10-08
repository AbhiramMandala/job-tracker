"""Dev-only usage dashboard. No auth by design; shows counts, never secrets."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ApiUsage, CacheEntry, Evidence, Job

templates = Jinja2Templates(directory="app/templates")
router = APIRouter()


@router.get("/debug/usage", response_class=HTMLResponse)
def usage(request: Request, db: Session = Depends(get_db)):
    rows = (
        db.query(ApiUsage.engine, ApiUsage.status, func.count(ApiUsage.id))
        .group_by(ApiUsage.engine, ApiUsage.status)
        .order_by(ApiUsage.engine, ApiUsage.status)
        .all()
    )
    total = sum(count for _, _, count in rows)
    return templates.TemplateResponse(
        request, "usage.html",
        {
            "rows": [{"engine": e, "status": s, "count": c} for e, s, c in rows],
            "total": total,
            "cache_entries": db.query(CacheEntry).count(),
            "jobs": db.query(Job).count(),
            "evidence_rows": db.query(Evidence).count(),
        },
    )
