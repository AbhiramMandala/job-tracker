"""Evidence (VERIFY) tests. All SerpApi traffic is stubbed."""

import httpx

from app.models import Candidate, Company, Evidence, Job
from app.schemas.search import parse_organic_results
from app.services.evidence import (
    STATUS_NEEDS,
    STATUS_SUPPORTING,
    STATUS_UNAVAILABLE,
    STATUS_WARNING,
    EvidenceService,
)
from app.services.serpapi_client import SerpApiClient

IDENTITY_BODY = {
    "organic_results": [
        {
            "position": 1,
            "title": "Acme Technologies \u2014 Official Site",
            "link": "https://acmetechnologies.com/",
            "displayed_link": "acmetechnologies.com",
            "snippet": "Acme Technologies builds software in Hyderabad, India.",
        },
        {
            "position": 2,
            "title": "Acme Technologies | LinkedIn",
            "link": "https://www.linkedin.com/company/acme-technologies",
            "displayed_link": "linkedin.com \u203a company",
            "snippet": "Acme Technologies is hiring Python Backend Developers in Hyderabad.",
        },
        {
            "position": 3,
            "title": "Acme Technologies Private Limited - Zauba Corp",
            "link": "https://www.zaubacorp.com/company/acme",
            "displayed_link": "zaubacorp.com",
            "snippet": "Acme Technologies Private Limited, Hyderabad.",
        },
    ]
}

LOCATION_BODY = {
    "organic_results": [
        {
            "position": 1,
            "title": "Acme Technologies Hyderabad Office",
            "link": "https://acmetechnologies.com/contact",
            "snippet": "Our Hyderabad office at HITEC City.",
        },
        {
            "position": 2,
            "title": "Acme Technologies reviews",
            "link": "https://www.glassdoor.co.in/acme-reviews",
            "snippet": "Reviews for Acme Technologies in Hyderabad.",
        },
    ]
}

EMPTY_BODY = {"organic_results": []}


class SearchStub:
    """Fake SerpApiClient.google_search. Routes bodies by query content."""

    def __init__(self, identity=None, location=None, error=None):
        self.identity = identity if identity is not None else IDENTITY_BODY
        self.location = location if location is not None else LOCATION_BODY
        self.error = error
        self.calls: list[str] = []

    def google_search(self, q, gl="in", hl="en"):
        self.calls.append(q)
        if self.error is not None:
            raise self.error
        # identity query carries two quoted segments ("company" "title"),
        # the location query only one ("company" city)
        if q.count('"') >= 4:
            return self.identity
        return self.location


def _db(client):
    from app.database import SessionLocal

    return SessionLocal()


def _acme_job(db, title="Python Backend Developer"):
    company = db.query(Company).filter_by(name_norm="acme tech").one_or_none()
    if company is None:
        company = Company(name_raw="Acme Technologies Pvt. Ltd.", name_norm="acme tech")
        db.add(company)
        db.flush()
    job = Job(
        company_id=company.id, title_raw=title, title_norm=title.lower(),
        location_raw="Hyderabad, Telangana, India", location_norm="hyderabad",
        description="Build APIs.", source_key=f"key-{title}-{company.id}",
    )
    job.company = company
    db.add(job)
    db.commit()
    return job


# -- parser ---------------------------------------------------------------


def test_official_site_heuristic():
    from app.utils import official_site_match

    assert official_site_match("acme tech", "https://acmetechnologies.com/")
    assert official_site_match("acme tech", "https://www.acmetechnologies.com/contact")
    assert not official_site_match("acme tech", "https://acme-foods-0.com/")
    assert not official_site_match("acme tech", "https://www.linkedin.com/company/acme")
    assert not official_site_match("", "https://acme.com/")
    assert not official_site_match("acme tech", "not a url")


def test_parse_organic_normal_missing_and_malformed():
    results = parse_organic_results(IDENTITY_BODY)
    assert len(results) == 3
    assert results[0].link.startswith("https://")
    assert parse_organic_results(EMPTY_BODY) == []
    assert parse_organic_results({"organic_results": [{"title": "Only"}]})[0].link == ""
    assert parse_organic_results({"organic_results": "nope"}) == []
    assert parse_organic_results(None) == []
    assert parse_organic_results({"no_results_here": True}) == []


# -- client shares the retry/error core ------------------------------------


def test_google_search_success_and_rate_limit():
    def ok(request):
        return httpx.Response(200, json=EMPTY_BODY)

    client = SerpApiClient(api_key="k", transport=httpx.MockTransport(ok))
    assert client.google_search("acme") == EMPTY_BODY

    calls = []

    def limited(request):
        calls.append(1)
        return httpx.Response(429, json={"error": "slow down"})

    from app.services.serpapi_client import SerpApiError

    client = SerpApiClient(api_key="k", transport=httpx.MockTransport(limited))
    try:
        client.google_search("acme")
        raise AssertionError("should raise")
    except SerpApiError as exc:
        assert exc.kind == "rate_limit"
    assert len(calls) == 1  # no retry on 429


# -- query design ------------------------------------------------------------


def test_queries_quote_company_and_target_city(client):
    db = _db(client)
    job = _acme_job(db)
    stub = SearchStub()
    EvidenceService(db, client=stub, max_jobs=1).enrich([job])
    assert len(stub.calls) == 2
    assert stub.calls[0] == '"Acme Technologies Pvt. Ltd." "Python Backend Developer"'
    assert stub.calls[1] == '"Acme Technologies Pvt. Ltd." Hyderabad'


def test_job_without_company_makes_no_requests(client):
    db = _db(client)
    company = Company(name_raw="", name_norm="")
    db.add(company)
    db.flush()
    job = Job(company_id=company.id, title_raw="Dev", source_key="k-nc")
    job.company = company
    db.add(job)
    db.flush()
    stub = SearchStub()
    summary = EvidenceService(db, client=stub, max_jobs=5).enrich_job(job)
    db.commit()
    assert stub.calls == []
    assert summary.status == STATUS_WARNING
    assert summary.reasons and "no company information" in summary.reasons[0]


# -- classification ------------------------------------------------------------


def test_supporting_evidence_with_website(client):
    db = _db(client)
    job = _acme_job(db)
    summary = EvidenceService(db, client=SearchStub(), max_jobs=1).enrich_job(job)
    db.commit()
    assert summary.status == STATUS_SUPPORTING
    assert any("Official website" in r for r in summary.reasons)
    assert any("Hyderabad presence" in r for r in summary.reasons)
    assert summary.source_count == 5
    assert "87%" not in " ".join(summary.reasons)  # no numeric scores, ever


def test_zero_presence_is_warning(client):
    db = _db(client)
    job = _acme_job(db)
    stub = SearchStub(identity=EMPTY_BODY, location=EMPTY_BODY)
    summary = EvidenceService(db, client=stub, max_jobs=1).enrich_job(job)
    db.commit()
    assert summary.status == STATUS_WARNING
    assert any("No independent search presence" in r for r in summary.reasons)


def test_ambiguous_identity_is_limited(client):
    db = _db(client)
    job = _acme_job(db, title="Clerk")
    bodies = {
        "organic_results": [
            {"title": "Acme Foods official", "link": f"https://acme-foods-{i}.com/",
             "snippet": "Acme foods company profile."}
            for i in range(4)
        ]
    }
    stub = SearchStub(identity=bodies, location=EMPTY_BODY)
    summary = EvidenceService(db, client=stub, max_jobs=1).enrich_job(job)
    db.commit()
    assert summary.status == STATUS_NEEDS
    assert any("Ambiguous identity" in r for r in summary.reasons)


def test_partial_presence_needs_verification(client):
    db = _db(client)
    job = _acme_job(db)
    weak_locations = {
        "organic_results": [
            {
                "position": 1,
                "title": "Acme Technologies reviews",
                "link": "https://www.glassdoor.co.in/acme-reviews",
                "snippet": "Reviews for Acme Technologies in Hyderabad.",
            },
            {
                "position": 2,
                "title": "Acme Technologies salaries in Hyderabad",
                "link": "https://www.ambitionbox.com/acme-salaries",
                "snippet": "Acme Technologies salaries reported from Hyderabad.",
            },
        ]
    }
    stub = SearchStub(identity=EMPTY_BODY, location=weak_locations)
    summary = EvidenceService(db, client=stub, max_jobs=1).enrich_job(job)
    db.commit()
    assert summary.status == STATUS_NEEDS
    assert not any("Official website" in r for r in summary.reasons)


# -- cache / persistence ---------------------------------------------------------


def test_second_enrichment_uses_cache_without_requests(client):
    db = _db(client)
    job = _acme_job(db)
    service = EvidenceService(db, client=SearchStub(), max_jobs=1)
    service.enrich([job])
    first_calls = len(service._client.calls)
    assert first_calls == 2
    before = db.query(Evidence).count()
    service.enrich([job])
    assert len(service._client.calls) == first_calls  # zero new requests
    assert db.query(Evidence).count() == before  # idempotent, no dup rows


def test_expired_cache_refetches(client):
    db = _db(client)
    job = _acme_job(db)
    stub = SearchStub()
    EvidenceService(db, client=stub, max_jobs=1, ttl_hours=-1).enrich([job])
    assert len(stub.calls) == 2
    EvidenceService(db, client=stub, max_jobs=1, ttl_hours=-1).enrich([job])
    assert len(stub.calls) == 4


def test_stale_fallback_after_failure(client):
    from app.services.serpapi_client import SerpApiError

    db = _db(client)
    job = _acme_job(db)
    EvidenceService(db, client=SearchStub(), max_jobs=1).enrich([job])
    # expire the cache rows directly, then fail live
    from app.models import CacheEntry

    for entry in db.query(CacheEntry).all():
        entry.expires_at = entry.retrieved_at
    db.commit()
    failing = SearchStub(error=SerpApiError("http", "down", 500))
    summary = EvidenceService(db, client=failing, max_jobs=1).enrich_job(job)
    db.commit()
    assert summary.stale and not summary.is_live
    assert summary.status == STATUS_SUPPORTING  # stale rows still classify


def test_total_failure_is_unavailable(client):
    from app.services.serpapi_client import SerpApiError

    db = _db(client)
    job = _acme_job(db)
    failing = SearchStub(error=SerpApiError("timeout", "slow"))
    summary = EvidenceService(db, client=failing, max_jobs=1).enrich_job(job)
    db.commit()
    assert summary.status == STATUS_UNAVAILABLE
    assert summary.reasons == []


def test_max_jobs_limits_requests(client):
    db = _db(client)
    jobs = [_acme_job(db, title=f"Role {i}") for i in range(3)]
    # unique source keys required
    for i, job in enumerate(jobs):
        job.source_key = f"max-jobs-{i}"
    db.commit()
    stub = SearchStub()
    summaries = EvidenceService(db, client=stub, max_jobs=2).enrich(jobs)
    assert len(summaries) == 2
    # Hard cap respected: at most 2 queries x 2 jobs. In practice fewer,
    # because same-company location queries share one cache entry.
    assert len(stub.calls) <= 4


# -- routes ----------------------------------------------------------------------


def test_evidence_page_shows_sources(client):
    db = _db(client)
    job = _acme_job(db)
    EvidenceService(db, client=SearchStub(), max_jobs=1).enrich([job])
    response = client.get(f"/jobs/{job.id}/evidence")
    assert response.status_code == 200
    assert "acmetechnologies.com" in response.text
    assert "Open source" in response.text
    assert "AI-generated" in response.text


def test_evidence_page_missing_job_and_empty(client):
    assert client.get("/jobs/99999/evidence").status_code == 404
    db = _db(client)
    job = _acme_job(db, title="Unseen Role")
    response = client.get(f"/jobs/{job.id}/evidence")
    assert response.status_code == 200
    assert "Verification unavailable" in response.text


def test_unsafe_source_urls_never_render(client):
    import datetime as dt

    db = _db(client)
    job = _acme_job(db)
    db.add(
        Evidence(
            job_id=job.id, engine="google", query="q", evidence_type="company_presence",
            claim="c", category="supporting", source_title="evil",
            source_url="javascript:alert(1)", retrieved_at=dt.datetime.now(dt.timezone.utc),
        )
    )
    db.commit()
    response = client.get(f"/jobs/{job.id}/evidence")
    assert response.status_code == 200
    assert "javascript:" not in response.text


def test_full_search_renders_verify_pillar(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    def fake_google_search(self, q, gl="in", hl="en"):
        if q.count('"') >= 4:
            return IDENTITY_BODY
        return LOCATION_BODY

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_search", fake_google_search)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "VERIFY" in response.text
    assert "Supporting evidence" in response.text
    assert "VIEW EVIDENCE" in response.text
    assert "LIVE" in response.text
