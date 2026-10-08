"""Liveness probe. Verifies SQLite is reachable; never claims health falsely."""

import logging

from fastapi import APIRouter, Response, status
from sqlalchemy.exc import SQLAlchemyError

from app.database import check_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
def health(response: Response):
    try:
        check_db()
    except SQLAlchemyError:
        logger.exception("health check: database unreachable")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "error", "database": "unreachable"}
    return {"status": "ok"}
