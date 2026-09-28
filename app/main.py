"""JobSetu FastAPI entrypoint. Routes stay thin; no business logic here."""

import logging
from pathlib import Path

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import get_settings
from app.database import init_db
from app.routes import debug, evidence, health, pages, profile, search

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("jobsetu")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def _lifespan(app: FastAPI):
        init_db()
        logger.info(
            "startup complete db=%s news=%s maps=%s trends=%s",
            settings.DATABASE_URL.split("://")[0],
            settings.ENABLE_NEWS,
            settings.ENABLE_MAPS,
            settings.ENABLE_TRENDS,
        )
        yield

    app = FastAPI(title="JobSetu", lifespan=_lifespan)

    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
    app.include_router(health.router)
    app.include_router(pages.router)
    app.include_router(search.router)
    app.include_router(evidence.router)
    app.include_router(debug.router)
    app.include_router(profile.router)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logger.exception("unhandled error path=%s", request.url.path)
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=500, content={"detail": "Internal error"})
        return templates.TemplateResponse(
            request, "error.html", {"message": "Something went wrong."}, status_code=500
        )

    return app


app = create_app()
