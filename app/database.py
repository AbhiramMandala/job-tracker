"""SQLite engine/session handling. Single place for DB setup."""

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)

Base = declarative_base()


def _connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def build_engine(url: str | None = None):
    settings = get_settings()
    db_url = url or settings.DATABASE_URL
    return create_engine(db_url, connect_args=_connect_args(db_url), future=True)


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    """Create tables if missing. No migrations in MVP (per architecture)."""
    from app import models  # noqa: F401  (register tables)

    Base.metadata.create_all(bind=engine)
    _ensure_column("api_usage", "duration_ms", "INTEGER DEFAULT 0")
    _ensure_column("jobs", "extra_links", "TEXT DEFAULT '[]'")
    _ensure_column("candidates", "preferred_role", "VARCHAR(200) DEFAULT ''")
    _ensure_column("candidates", "job_type_pref", "VARCHAR(50) DEFAULT 'any'")
    _ensure_column("evidences", "evidence_type", "VARCHAR(50) DEFAULT ''")
    _ensure_column("evidences", "source_date", "TEXT DEFAULT ''")
    logger.info("database initialized")


def _ensure_column(table: str, column: str, ddl: str) -> None:
    """Additive safety net for dev DBs created before a column existed.

    Fresh checkouts get the column via create_all; this only heals stale
    local files so they degrade to a friendly error page instead of a 500.
    """
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
        if column not in existing:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
            conn.commit()
            logger.info("added missing column %s.%s", table, column)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db() -> None:
    """Raise if SQLite is unreachable so /health never lies."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
