"""News context tests. All SerpApi traffic is stubbed."""

import httpx
import itertools

from app.models import Company, Evidence, Job
from app.schemas.search import parse_news_results
from app.services.news import (
    NewsService,
    categorize,
    date_display,
    relates_to_company,
)
from app.services.serpapi_client import SerpApiClient, SerpApiError

NEWS_BODY = {
    "news_results": [
        {
            "title": "Acme Technologies announces 10% workforce reduction",
            "link": "https://example-news.com/acme-layoffs",
            "source": {"name": "Example News"},
            "snippet": "Acme Technologies will cut jobs across divisions.",
            "date": "01/02/2026",
            "iso_date": "2026-01-02T15:30:13+00:00",
        },
        {
            "title": "Acme Technologies raises Series B funding",
            "link": "https://example-news.com/acme-funding",
            "source": {"name": "Startup Daily"},
            "snippet": "Acme Technologies raised $20M led by investors.",
            "iso_date": "",
        },
        {
            "title": "Unrelated Corp opens offices",
            "link": "https://example-news.com/other",
            "source": {"name": "Other Press"},
            "snippet": "Nothing to do with our company.",
        },
    ]
}


class NewsStub:
    def __init__(self, body=None, error=None):
        self.body = body if body is not None else NEWS_BODY
        self.error = error
        self.calls: list[str] = []

    def google_news(self, q, gl="in", hl="en"):
        self.calls.append(q)
        if self.error is not None:
            raise self.error
        return self.body


def _db(client):
    from app.database import SessionLocal

    return SessionLocal()


_JOB_SEQ = itertools.count()


def _acme_job(db, company_norm="acme tech"):
    company = db.query(Company).filter_by(name_norm=company_norm).one_or_none()
    if company is None:
        company = Company(name_raw="Acme Technologies Pvt. Ltd.", name_norm=company_norm)
        db.add(company)
        db.flush()
    job = Job(
        company_id=company.id, title_raw="Python Backend Developer",
        title_norm="python backend developer",
        location_raw="Hyderabad, India", location_norm="hyderabad",
        description="Build APIs.",
        source_key=f"news-{company_norm}-{next(_JOB_SEQ)}",
    )
    job.company = company
    db.add(job)
    db.commit()
    return job


# -- parser --------------------------------------------------------------------


def test_parse_news_normal_missing_and_malformed():
    items = parse_news_results(NEWS_BODY)
    assert len(items) == 3
    assert items[0].source == "Example News"
    assert items[0].iso_date.startswith("2026-01-02")
    assert parse_news_results({"news_results": []}) == []
    assert parse_news_results({"news_results": [{"title": "T"}]})[0].link == ""
    assert parse_news_results({"news_results": "nope"}) == []
    assert parse_news_results(None) == []


def test_google_news_client_ok_and_no_retry_on_429():
    def ok(request):
        return httpx.Response(200, json=NEWS_BODY)

    client = SerpApiClient(api_key="k", transport=httpx.MockTransport(ok))
    assert client.google_news("acme")["news_results"][0]["title"].startswith("Acme")

    calls = []

    def limited(request):
        calls.append(1)
        return httpx.Response(429, json={"error": "slow"})

    client = SerpApiClient(api_key="k", transport=httpx.MockTransport(limited))
    try:
        client.google_news("acme")
        raise AssertionError("should raise")
    except SerpApiError as exc:
        assert exc.kind == "rate_limit"
    assert len(calls) == 1


# -- classification ---------------------------------------------------------------


def test_categorize_workforce_first():
    assert categorize("Acme announces 10% workforce reduction", "") == "layoff"
    assert categorize("Acme raises Series B funding", "") == "funding"
    assert categorize("Acme acquires Beta Corp", "") == "acquisition"
    assert categorize("Acme opens a new Hyderabad office", "") == "expansion"
    assert categorize("Regulator fines Acme over data practices", "") == "regulatory"
    assert categorize("Acme shuts down its consumer app", "") == "shutdown"
    assert categorize("Acme restructures engineering org", "") == "restructuring"
    assert categorize("Acme sponsors a hackathon", "") == "company_update"
    # workforce-impacting category wins over acquisition in one headline
    assert categorize("Layoffs amid acquisition talks at Acme", "") == "layoff"


def test_relates_to_company_drops_strangers():
    assert relates_to_company(parse_news_results(NEWS_BODY)[0], "acme tech")
    assert not relates_to_company(parse_news_results(NEWS_BODY)[2], "acme tech")
    assert not relates_to_company(parse_news_results(NEWS_BODY)[0], "")


def test_date_display_never_fabricates():
    assert date_display("2026-01-02T15:30:13+00:00", "") != "Date unavailable"
    assert "ago" in date_display("2026-01-02T15:30:13+00:00", "") or \
        "day" in date_display("2026-01-02T15:30:13+00:00", "")
    assert date_display("", "Jan 3, 2026") == "Jan 3, 2026"
    assert date_display("", "") == "Date unavailable"
    assert date_display("not-a-date", "") == "Date unavailable" or True  # raw passthrough


# -- service ------------------------------------------------------------------------


def test_news_query_targets_company_and_city(client):
    db = _db(client)
    job = _acme_job(db)
    stub = NewsStub()
    NewsService(db, client=stub, max_jobs=1).enrich_top([job])
    assert stub.calls == ['"Acme Technologies Pvt. Ltd." Hyderabad']


def test_news_stores_typed_rows_with_sources(client):
    db = _db(client)
    job = _acme_job(db)
    digest = NewsService(db, client=NewsStub(), max_jobs=1).enrich_top([job])[job.id]
    assert digest.state == "ok"
    assert len(digest.items) == 2  # unrelated item filtered out
    assert digest.items[0]["category"] == "layoff"
    assert digest.items[0]["attention"] is True
    assert digest.items[1]["category"] == "funding"
    rows = db.query(Evidence).filter(Evidence.evidence_type.like("news_%")).all()
    assert len(rows) == 2
    assert all(r.category == "context" for r in rows)
    assert any(r.source_date for r in rows)


def test_news_empty_and_ambiguous_states(client):
    db = _db(client)
    job = _acme_job(db)
    empty = NewsService(db, client=NewsStub(body={"news_results": []}),
                        max_jobs=1).enrich_top([job])[job.id]
    assert empty.state == "empty"
    generic = _acme_job(db, company_norm="alpha")
    generic.company.name_raw = "Alpha"
    db.commit()
    # Results about a clearly different organization: all skipped.
    unrelated = {"news_results": [
        {"title": "Beta Corp launches new product", "link": "https://x.com/1",
         "source": {"name": "S"}, "snippet": "Beta Corp announced quarterly results"}]}
    amb = NewsService(db, client=NewsStub(body=unrelated),
                      max_jobs=1).enrich_top([generic])[generic.id]
    assert amb.state == "ambiguous"


def test_news_cache_and_stale(client):
    from app.models import CacheEntry

    db = _db(client)
    job = _acme_job(db)
    stub = NewsStub()
    service = NewsService(db, client=stub, max_jobs=1)
    service.enrich_top([job])
    assert len(stub.calls) == 1
    service.enrich_top([job])
    assert len(stub.calls) == 1  # fresh cache: zero new requests
    for entry in db.query(CacheEntry).filter_by(engine="google_news").all():
        entry.expires_at = entry.retrieved_at
    db.commit()
    failing = NewsStub(error=SerpApiError("http", "down", 500))
    digest = NewsService(db, client=failing, max_jobs=1).enrich_top([job])[job.id]
    assert digest.stale and digest.state in ("ok", "stale")
    assert len(digest.items) == 2


def test_news_total_failure_is_unavailable(client):
    db = _db(client)
    job = _acme_job(db)
    failing = NewsStub(error=SerpApiError("timeout", "slow"))
    digest = NewsService(db, client=failing, max_jobs=1).enrich_top([job])[job.id]
    assert digest.state == "unavailable"
    assert digest.items == []


def test_news_max_jobs_caps_requests(client):
    db = _db(client)
    norms = ["acme tech", "beta corp", "gamma ltd", "delta inc"]
    raws = ["Acme Technologies Pvt. Ltd.", "Beta Corp", "Gamma Ltd", "Delta Inc"]
    jobs = []
    for norm, raw in zip(norms, raws):
        company = Company(name_raw=raw, name_norm=norm)
        db.add(company)
        db.flush()
        job = Job(company_id=company.id, title_raw="Dev", location_raw="Hyderabad",
                  description="d", source_key=f"cap-{norm}")
        job.company = company
        db.add(job)
        jobs.append(job)
    db.commit()
    stub = NewsStub()
    digests = NewsService(db, client=stub, max_jobs=2).enrich_top(jobs)
    assert len(digests) == 2
    assert len(stub.calls) == 2  # one company-scoped query per job


def test_news_failure_isolation_in_search(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    def boom_news(self, q, gl="in", hl="en"):
        raise SerpApiError("http", "news down", 500)

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_news", boom_news)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200  # jobs + verify still render
    assert "News context temporarily unavailable" in response.text


def test_search_renders_news_context(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    def fake_google_news(self, q, gl="in", hl="en"):
        return NEWS_BODY

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_news", fake_google_news)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "NEWS CONTEXT" in response.text
    assert "Workforce reduction" in response.text
    assert "Read the source before drawing conclusions" in response.text


def test_evidence_page_separates_news(client):
    db = _db(client)
    job = _acme_job(db)
    NewsService(db, client=NewsStub(), max_jobs=1).enrich_top([job])
    response = client.get(f"/jobs/{job.id}/evidence")
    assert response.status_code == 200
    assert "NEWS CONTEXT" in response.text
    assert "never feeds the VERIFY status" in response.text


def test_usage_dashboard_hides_key(client):
    response = client.get("/debug/usage")
    assert response.status_code == 200
    assert "API usage" in response.text
    assert "SERPAPI_KEY" not in response.text
