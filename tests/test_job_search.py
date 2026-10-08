"""Cache + JobSearchService + /search route tests. SerpApi is stubbed."""

import pytest

from app.models import ApiUsage, Job, Search
from app.services.cache import CacheService
from app.services.job_search import JobSearchService
from app.services.serpapi_client import SerpApiError
from tests._fixtures import EMPTY, PAGE_1, PAGE_2


def _db_session(client):
    from app.database import SessionLocal

    return SessionLocal()


class StubClient:
    """Fake SerpApiClient: returns canned pages or raises."""

    def __init__(self, pages=None, error=None):
        self._pages = pages or []
        self._error = error
        self.calls = []

    def google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        self.calls.append((q, location, next_page_token))
        if self._error is not None:
            raise self._error
        if next_page_token == "":
            return self._pages[0]
        if next_page_token == "TOKEN-2" and len(self._pages) > 1:
            return self._pages[1]
        return EMPTY


# -- cache -------------------------------------------------------------


def test_cache_miss_hit_expiry(client):
    db = _db_session(client)
    cache = CacheService(db)
    params = {"q": "x", "location": "Hyderabad, India", "gl": "in", "hl": "en"}
    assert cache.get("google_jobs", params) is None
    cache.set("google_jobs", params, {"items": [], "raw_count": 0}, ttl_hours=24)
    db.commit()
    assert cache.get("google_jobs", params) is not None
    cache.set("google_jobs", params, {"items": [], "raw_count": 0}, ttl_hours=-1)
    db.commit()
    assert cache.get("google_jobs", params) is None  # expired
    assert cache.get_stale("google_jobs", params) is not None  # stale kept


# -- service ------------------------------------------------------------


def test_successful_search_persists_and_logs(client):
    db = _db_session(client)
    stub = StubClient(pages=[PAGE_1, PAGE_2])
    result = JobSearchService(db, client=stub).run(
        "Python Backend Developer", "Hyderabad", "Fresher"
    )
    assert result.is_live and not result.stale
    assert result.raw_count == 4  # 3 + 1 across two pages
    # PAGE_1 items 1+2 are the same posting via different domains:
    # different source_keys, merged by TF-IDF similarity.
    assert result.canonical_count == 3
    assert result.dup_removed == 1
    assert stub.calls[0][0] == "Python Backend Developer"
    assert stub.calls[0][1] == "Hyderabad, India"
    assert len(stub.calls) == 2  # pagination followed once
    assert db.query(Job).count() == 3
    assert db.query(ApiUsage).count() == 2
    search = db.query(Search).one()
    assert (search.raw_count, search.canonical_count, search.dup_removed) == (4, 3, 1)
    merged = db.query(Job).filter(Job.title_norm.like("%python backend%")).one()
    assert merged.dup_count == 1
    assert "LinkedIn" in (merged.via or "") and "Indeed" in (merged.via or "")
    assert "linkedin.com/job-1" in (merged.extra_links or "")
    assert merged.salary_text == "6-10 LPA"  # kept from the richer duplicate


def test_repeated_search_is_idempotent_and_uses_cache(client):
    db = _db_session(client)
    stub = StubClient(pages=[PAGE_1, EMPTY])
    first = JobSearchService(db, client=stub).run("Dev", "Hyderabad", "Fresher")
    assert first.is_live
    calls_after_first = len(stub.calls)
    second = JobSearchService(db, client=stub).run("Dev", "Hyderabad", "Fresher")
    assert not second.is_live  # served from cache
    assert len(stub.calls) == calls_after_first  # no new HTTP calls
    assert db.query(Job).count() == first.canonical_count == second.canonical_count


def test_empty_results_are_valid(client):
    db = _db_session(client)
    result = JobSearchService(db, client=StubClient(pages=[EMPTY])).run(
        "Cobol Astronaut", "Hyderabad", "Fresher"
    )
    assert result.jobs == [] and result.raw_count == 0 and result.is_live


def test_api_failure_with_stale_cache_serves_stale(client):
    db = _db_session(client)
    cache = CacheService(db)
    params = {
        "q": "Dev",
        "location": "Hyderabad, India",
        "gl": "in",
        "hl": "en",
    }
    cache.set("google_jobs", params, {"items": [], "raw_count": 0}, ttl_hours=-1)
    db.commit()
    failing = StubClient(error=SerpApiError("http", "down", 500))
    result = JobSearchService(db, client=failing).run("Dev", "Hyderabad", "Fresher")
    assert result.stale and not result.is_live


def test_api_failure_without_cache_raises(client):
    db = _db_session(client)
    failing = StubClient(error=SerpApiError("timeout", "slow"))
    with pytest.raises(SerpApiError):
        JobSearchService(db, client=failing).run("Dev", "Hyderabad", "Fresher")
    # the failed attempt is still logged (usage committed before re-raise)
    from app.database import SessionLocal as _SessionLocal

    check = _SessionLocal()
    try:
        rows = check.query(ApiUsage).all()
        assert [r.status for r in rows] == ["timeout"]
    finally:
        check.close()


def test_invalid_input_rejected(client):
    db = _db_session(client)
    with pytest.raises(ValueError):
        JobSearchService(db, client=StubClient()).run("", "Hyderabad", "Fresher")
    with pytest.raises(ValueError):
        JobSearchService(db, client=StubClient()).run("Dev", "", "Fresher")


# -- route ---------------------------------------------------------------


def test_search_route_renders_results(client, monkeypatch):
    from app.services import serpapi_client as client_module

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    monkeypatch.setattr(
        client_module.SerpApiClient, "google_jobs", fake_google_jobs
    )
    import app.config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("SERPAPI_KEY", "route-test-key")

    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad", "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "Python Backend Developer" in response.text
    assert "Acme Technologies" in response.text
    assert "LIVE" in response.text


def test_search_route_rejects_empty_input(client):
    response = client.post(
        "/search", data={"role": "", "location": "Hyderabad", "experience": "Fresher"}
    )
    assert response.status_code == 400


def test_search_route_failure_without_cache_is_503(client, monkeypatch):
    from app.services import serpapi_client as client_module

    def boom(self, q, location, gl="in", hl="en", next_page_token=""):
        raise SerpApiError("auth", "bad key", 401)

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", boom)
    response = client.post(
        "/search", data={"role": "Dev", "location": "Hyderabad", "experience": "Fresher"}
    )
    assert response.status_code == 503
    assert "temporarily unavailable" in response.text
    assert "SERPAPI_KEY" not in response.text


# -- adaptive discovery: page-level contribution + failure tolerance ------


class PageTwoFailsClient(StubClient):
    """Page 1 succeeds; page 2 raises (partial outage)."""

    def google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        self.calls.append((q, location, next_page_token))
        if next_page_token != "":
            raise SerpApiError("timeout", "page 2 slow")
        return self._pages[0]


def test_page_two_failure_returns_page_one_results(client):
    db = _db_session(client)
    result = JobSearchService(
        db, client=PageTwoFailsClient(pages=[PAGE_1, PAGE_2])
    ).run("Dev", "Hyderabad", "Fresher")
    assert result.is_live and not result.stale
    assert result.raw_count == 3 and result.canonical_count == 2
    rows = db.query(ApiUsage).order_by(ApiUsage.id).all()
    assert [r.status for r in rows] == ["ok", "timeout"]


def test_page_two_all_duplicates_merges_cleanly(client):
    db = _db_session(client)
    dup_page = {
        "jobs_results": [dict(PAGE_1["jobs_results"][0])],
        "serpapi_pagination": {},
    }
    result = JobSearchService(db, client=StubClient(pages=[PAGE_1, dup_page])).run(
        "Dev", "Hyderabad", "Fresher"
    )
    assert result.raw_count == 4
    assert result.canonical_count == 2  # nothing new from page 2
    assert result.dup_removed == 2


def test_discovery_logs_per_page_telemetry(client, caplog):
    import logging

    db = _db_session(client)
    with caplog.at_level(logging.INFO, logger="app.services.job_search"):
        JobSearchService(db, client=StubClient(pages=[PAGE_1, PAGE_2])).run(
            "Dev", "Hyderabad", "Fresher"
        )
    assert any("discovery q=" in rec.message and "pages=2" in rec.message
               for rec in caplog.records)


def test_page_two_jobs_participate_in_ranking(client):
    from app.models import Candidate, Match

    db = _db_session(client)
    db.add(Candidate(name="T", preferred_role="DevOps", location="Bengaluru",
                     experience_years=0, job_type_pref="any", is_active=True))
    db.commit()
    JobSearchService(db, client=StubClient(pages=[PAGE_1, PAGE_2])).run(
        "Dev", "Hyderabad", "Fresher"
    )
    page_two_job = db.query(Job).filter(Job.title_norm.like("%devops%")).one_or_none()
    assert page_two_job is not None
    match = db.query(Match).filter_by(job_id=page_two_job.id).one_or_none()
    assert match is not None  # page-2 jobs are matched like all others
