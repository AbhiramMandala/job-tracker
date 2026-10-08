"""SQLite-backed cache over the `cache_entries` table. No framework."""

import datetime as dt
import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models import CacheEntry

logger = logging.getLogger(__name__)

JOBS_TTL_HOURS = 24


def make_key(engine: str, params: dict) -> str:
    canonical = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(f"{engine}|{canonical}".encode()).hexdigest()


@dataclass
class CacheHit:
    payload: Any
    retrieved_at: dt.datetime
    is_fresh: bool


class CacheService:
    def __init__(self, db: Session):
        self._db = db

    def get(self, engine: str, params: dict) -> CacheHit | None:
        """Fresh hit only. Returns None on miss or expiry."""
        key = make_key(engine, params)
        entry = self._db.get(CacheEntry, key)
        if entry is None:
            return None
        now = dt.datetime.now(dt.timezone.utc)
        retrieved = _aware(entry.retrieved_at)
        if entry.expires_at is not None and _aware(entry.expires_at) <= now:
            return None
        return CacheHit(payload=entry.payload, retrieved_at=retrieved, is_fresh=True)

    def get_stale(self, engine: str, params: dict) -> CacheHit | None:
        """Fresh or expired entry, for failure fallback. Never raises."""
        key = make_key(engine, params)
        entry = self._db.get(CacheEntry, key)
        if entry is None:
            return None
        retrieved = _aware(entry.retrieved_at)
        now = dt.datetime.now(dt.timezone.utc)
        fresh = entry.expires_at is None or _aware(entry.expires_at) > now
        return CacheHit(payload=entry.payload, retrieved_at=retrieved, is_fresh=fresh)

    def set(self, engine: str, params: dict, payload: Any, ttl_hours: int) -> None:
        now = dt.datetime.now(dt.timezone.utc)
        entry = CacheEntry(
            cache_key=make_key(engine, params),
            engine=engine,
            payload=payload,
            retrieved_at=now,
            expires_at=now + dt.timedelta(hours=ttl_hours),
        )
        self._db.merge(entry)
        self._db.flush()
        logger.info("cache set engine=%s key=%s", engine, entry.cache_key[:12])


def _aware(value: dt.datetime) -> dt.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value
