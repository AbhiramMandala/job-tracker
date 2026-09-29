"""Progressive-enrichment tests. POST /search stays fast (jobs only);
deep sections arrive via GET /api/enrich/{verify,news,interview}.
All hermetic: fake SerpApi, temp DB."""

import re

from app.services.serpapi_client import SerpApiError

IDENTITY_BODY = {
    "organic_results": [
        {"title": "Acme Technologies official site",
         "link": "https://acmetechnologies.com/",
         "snippet": "Acme Technologies Pvt Ltd official website."},
        {"title": "Acme Tech Hyderabad careers",
         "link": "https://acmetechnologies.com/careers",
         "snippet": "Acme Tech backend developer careers in Hyderabad."},
    ]
}

NEWS_BODY = {
    "news_results": [
        {"title": "Acme Tech raises funding",
         "source": {"name": "TechNews"}, "link": "https://technews.example/funding",
         "date": "2 days ago", "iso_date": "2026-09-27T00:00:00Z",
         "snippet": "Acme Tech raises Series B funding for expansion."},
    ]
}

INTERVIEW_BODY = {
    "organic_results": [
        {"title": "Acme Tech interview experience",
         "link": "https://example.com/acme-interview",
         "snippet": "Online assessment then a technical interview about Python."},
    ]
}


def _fakes(monkeypatch, search_body=None, news_body=None, error=None):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    calls = {"jobs": 0, "search": 0, "news": 0}

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        calls["jobs"] += 1
        return PAGE_1 if not next_page_token else EMPTY

    def fake_google_search(self, q, gl="in", hl="en"):
        calls["search"] += 1
        if error is not None:
            raise error
        return search_body if search_body is not None else IDENTITY_BODY

    def fake_google_news(self, q, gl="in", hl="en"):
        calls["news"] += 1
        if error is not None:
            raise error
        return news_body if news_body is not None else NEWS_BODY

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_search", fake_google_search)
    monkeypatch.setattr(client_module.SerpApiClient, "google_news", fake_google_news)
    return calls


def _profile(client):
    client.post(
        "/profile",
        data={"name": "Tester", "experience": "Fresher",
              "preferred_role": "Python Backend Developer",
              "location": "Hyderabad", "job_type_pref": "any",
              "skills": "Python, FastAPI"},
    )


def _search_id(client, monkeypatch, **bodies):
    _profile(client)
    calls = _fakes(monkeypatch, **bodies)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    match = re.search(r'data-search-id="(\d+)"', response.text)
    assert match, "fast cards must expose the search id for enrichment"
    return int(match.group(1)), calls, response.text


# -- fast-path contract -------------------------------------------------


def test_post_makes_zero_enrichment_calls(client, monkeypatch):
    from app.config import get_settings

    _, calls, html = _search_id(client, monkeypatch)
    assert calls["search"] == 0, "POST must not wait on evidence/interview search"
    assert calls["news"] == 0, "POST must not wait on news"
    assert calls["jobs"] > 0, "discovery still runs"
    assert get_settings().EVIDENCE_MAX_JOBS == 5  # caps intact
    assert html.count('data-enrich="verify"') <= 5
    assert html.count('data-enrich="news"') <= 3
    assert html.count('data-enrich="interview"') <= 3


def test_fast_cards_carry_placeholders_and_filters(client, monkeypatch):
    _, _, html = _search_id(client, monkeypatch)
    assert "Checking supporting evidence" in html
    assert "Loading relevant news" in html
    assert "Finding public interview evidence" in html
    assert 'id="filter-verify"' in html
    assert "% MATCH" in html  # match + gaps still inline


# -- endpoint contract --------------------------------------------------


def test_unknown_kind_and_search_404(client):
    assert client.get("/api/enrich/nope?search_id=1").status_code == 404
    assert client.get("/api/enrich/verify?search_id=999999").status_code == 404


def test_verify_endpoint_shape_and_content(client, monkeypatch):
    search_id, _, _ = _search_id(client, monkeypatch)
    body = client.get(f"/api/enrich/verify?search_id={search_id}").json()
    assert body["search_id"] == search_id and body["kind"] == "verify"
    assert body["items"], "top jobs get verify panels"
    assert set(body) >= {"items", "timings_ms", "statuses"}
    assert body["timings_ms"]["verify_ms"] >= 0
    first = next(iter(body["items"].values()))
    assert "VERIFY ·" in first  # thin fixtures yield needs-verification: honest
    assert "VIEW EVIDENCE" in first
    assert set(body["statuses"]) == set(body["items"])


def test_news_endpoint_shape_and_content(client, monkeypatch):
    search_id, _, _ = _search_id(client, monkeypatch)
    body = client.get(f"/api/enrich/news?search_id={search_id}").json()
    assert body["kind"] == "news"
    assert body["items"]
    assert body["timings_ms"]["news_ms"] >= 0
    assert "NEWS CONTEXT" in next(iter(body["items"].values()))


def test_interview_endpoint_shape_and_content(client, monkeypatch):
    search_id, _, _ = _search_id(
        client, monkeypatch, search_body=INTERVIEW_BODY)
    body = client.get(f"/api/enrich/interview?search_id={search_id}").json()
    assert body["kind"] == "interview"
    assert body["items"]
    assert body["timings_ms"]["interview_ms"] >= 0
    assert "SELECTION PROCESS" in next(iter(body["items"].values()))


def test_enrich_respects_call_caps(client, monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    search_id, calls, _ = _search_id(client, monkeypatch)
    before = dict(calls)
    client.get(f"/api/enrich/verify?search_id={search_id}")
    client.get(f"/api/enrich/news?search_id={search_id}")
    client.get(f"/api/enrich/interview?search_id={search_id}")
    assert calls["search"] - before["search"] <= 2 * settings.EVIDENCE_MAX_JOBS + \
        2 * settings.INTERVIEW_MAX_JOBS
    assert calls["news"] - before["news"] <= settings.NEWS_MAX_JOBS


def test_enrich_failure_renders_unavailable_not_500(client, monkeypatch):
    search_id, _, _ = _search_id(
        client, monkeypatch, error=SerpApiError("http", "down", 500))
    for kind in ("verify", "news", "interview"):
        response = client.get(f"/api/enrich/{kind}?search_id={search_id}")
        assert response.status_code == 200
        body = response.json()
        # Every item is either an honest unavailable state or a rendered
        # panel (e.g. the company-less listing still gets its warning panel).
        for html in body["items"].values():
            assert "unavailable" in html.lower() or "VIEW EVIDENCE" in html \
                or "NEWS CONTEXT" in html or "SELECTION PROCESS" in html \
                or "No candidate interview reports" in html \
                or "News context" in html


def test_enrich_is_cache_first_second_call_free(client, monkeypatch):
    search_id, calls, _ = _search_id(client, monkeypatch)
    client.get(f"/api/enrich/verify?search_id={search_id}")
    before = dict(calls)
    body = client.get(f"/api/enrich/verify?search_id={search_id}").json()
    assert body["items"], "cached enrich still returns panels"
    assert calls["search"] - before["search"] == 0, "warm enrich makes no HTTP calls"


def test_enrich_unexpected_error_stays_200(client, monkeypatch):
    from app.services import evidence as evidence_module

    search_id, _, _ = _search_id(client, monkeypatch)

    def boom(self, jobs, totals=None):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(evidence_module.EvidenceService, "enrich", boom)
    response = client.get(f"/api/enrich/verify?search_id={search_id}")
    assert response.status_code == 200
    assert response.json()["items"] == {}


def test_empty_search_enrich_returns_no_items(client, monkeypatch):
    from app.services import serpapi_client as client_module

    def empty_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return {"jobs_results": [], "serpapi_pagination": {}}

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", empty_jobs)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "No jobs found" in response.text


def test_sqlite_uses_wal_for_concurrent_enrichment():
    import os
    import tempfile
    from sqlalchemy import text

    from app.database import build_engine

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    engine = build_engine(f"sqlite:///{tmp.name}")
    try:
        with engine.connect() as conn:
            assert conn.execute(text("PRAGMA journal_mode")).scalar() == "wal"
    finally:
        engine.dispose()
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def test_concurrent_enrich_requests_all_succeed(client, monkeypatch):
    import concurrent.futures

    search_id, _, _ = _search_id(client, monkeypatch)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = [
            pool.submit(client.get, f"/api/enrich/{kind}?search_id={search_id}")
            for kind in ("verify", "news", "interview")
        ]
        responses = [f.result() for f in futures]
    assert [r.status_code for r in responses] == [200, 200, 200]
    assert all(r.json()["items"] for r in responses)
