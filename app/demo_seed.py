"""Warm the judge-demo cache. Run: python -m app.demo_seed

Verifies SERPAPI_KEY, runs the demo search end-to-end (jobs + evidence +
news), ensures the sample demo profile exists, and prints measured
request/credit counts plus elapsed time. Everything stored comes from live
SerpApi responses — no synthetic data, no secrets printed.
"""

import logging
import sys
import time

logging.basicConfig(level=logging.WARNING)

DEMO_ROLE = "Python Backend Developer"
DEMO_LOCATION = "Hyderabad"
DEMO_EXPERIENCE = "Fresher"


def main() -> int:
    from app.config import get_settings
    from app.database import SessionLocal, init_db

    settings = get_settings()
    if not settings.SERPAPI_KEY:
        print("LIVE SERPAPI TEST BLOCKED: SERPAPI_KEY unavailable.")
        print("Set SERPAPI_KEY in .env, then re-run.")
        return 1

    init_db()
    db = SessionLocal()
    started = time.monotonic()
    try:
        candidate = _ensure_demo_profile(db)
        from app.services.evidence import EvidenceService
        from app.services.job_search import JobSearchService
        from app.services.news import NewsService

        result = JobSearchService(db).run(DEMO_ROLE, DEMO_LOCATION, DEMO_EXPERIENCE)
        from app.models import Match

        totals = {
            row.job_id: row.total
            for row in db.query(Match)
            .filter_by(candidate_id=candidate.id)
            .all()
        } if candidate is not None else {}
        verify = EvidenceService(db).enrich(result.jobs, totals or None)
        news = NewsService(db).enrich_top(result.jobs, totals or None)
    finally:
        elapsed = time.monotonic() - started
        db.close()

    _report(result, verify, news, elapsed)
    return 0


def _ensure_demo_profile(db):
    from app.models import Candidate, CandidateSkill
    from app.routes.profile import DEMO_PROFILE, get_active_candidate, parse_skills

    candidate = get_active_candidate(db)
    if candidate is not None:
        print(f"profile: existing candidate id={candidate.id} kept as-is")
        return candidate
    from app.routes.profile import EXPERIENCE_YEARS

    candidate = Candidate(
        name=DEMO_PROFILE["name"],
        preferred_role=DEMO_PROFILE["preferred_role"],
        location=DEMO_PROFILE["location"],
        experience_years=EXPERIENCE_YEARS[DEMO_PROFILE["experience"]],
        job_type_pref=DEMO_PROFILE["job_type_pref"],
        is_active=True,
    )
    db.add(candidate)
    db.flush()
    for norm in parse_skills(DEMO_PROFILE["skills"]):
        db.add(CandidateSkill(candidate_id=candidate.id, skill_norm=norm,
                              source="demo-seed"))
    db.commit()
    print("profile: created clearly-labeled sample demo profile "
          f"({DEMO_PROFILE['skills']})")
    return candidate


def _report(result, verify, news, elapsed) -> None:
    from app.database import SessionLocal
    from app.models import ApiUsage, CacheEntry
    from sqlalchemy import func

    db = SessionLocal()
    try:
        usage = (
            db.query(ApiUsage.engine, ApiUsage.status, func.count(ApiUsage.id))
            .group_by(ApiUsage.engine, ApiUsage.status)
            .all()
        )
        cache_count = db.query(CacheEntry).count()
    finally:
        db.close()
    print(f"query: {DEMO_ROLE} / {DEMO_LOCATION} / {DEMO_EXPERIENCE}")
    print(f"elapsed: {elapsed:.1f}s")
    print("api calls (this database, all time):")
    total = 0
    for engine, status, count in sorted(usage):
        print(f"  {engine:15s} {status:10s} {count}")
        total += count
    print(f"  {'TOTAL':15s} {'':10s} {total}")
    print(f"cache entries: {cache_count}")
    print(f"jobs: raw={result.raw_count} unique={result.canonical_count} "
          f"dups={result.dup_removed} live={result.is_live}")
    by_status: dict[str, int] = {}
    for summary in verify.values():
        by_status[summary.status] = by_status.get(summary.status, 0) + 1
    print(f"verify: {by_status or 'none'}")
    by_state: dict[str, int] = {}
    for digest in news.values():
        by_state[digest.state] = by_state.get(digest.state, 0) + 1
    print(f"news: {by_state or 'none'}")
    print("Done. Serve with: python -m uvicorn app.main:app")


if __name__ == "__main__":
    sys.exit(main())
