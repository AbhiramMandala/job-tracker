"""Interview selection-process tests. All hermetic: fake SerpApi client,
temp DB. No network, no key needed."""

import datetime as dt

from app.models import Company, Evidence, Job
from app.services.interview import (
    INTERVIEW_DISCLAIMER,
    InterviewService,
    detect_stages,
    display_dict,
    relates_to_company,
    stage_label,
    summarize_reports,
)
from app.services.serpapi_client import SerpApiError


BODY_TECH = {
    "organic_results": [
        {"title": "Acme Tech interview experience: technical interview and HR round",
         "link": "https://www.glassdoor.co.in/acme-tech-interview",
         "snippet": "First an online assessment on HackerRank, then a technical "
                    "interview about Python, finally the HR interview."},
        {"title": "Acme Tech SDE interview questions",
         "link": "https://www.ambitionbox.com/acme-tech-interviews",
         "snippet": "Technical interview focused on DSA. No aptitude test this time."},
    ]
}

BODY_UNRELATED = {
    "organic_results": [
        {"title": "Globex Corp technical interview experience",
         "link": "https://example.com/globex-interview",
         "snippet": "Technical interview and HR round at Globex."},
    ]
}

BODY_NO_STAGES = {
    "organic_results": [
        {"title": "Acme Tech careers page",
         "link": "https://acmetechnologies.com/careers",
         "snippet": "Join our engineering team in Hyderabad."},
    ]
}


class FakeSearch:
    def __init__(self, bodies=None, error=None):
        self.calls = []
        self.bodies = bodies if bodies is not None else [BODY_TECH]
        self.error = error
        self.index = 0

    def google_search(self, q, gl="in", hl="en"):
        self.calls.append(q)
        if self.error is not None:
            raise self.error
        body = self.bodies[min(self.index, len(self.bodies) - 1)]
        self.index += 1
        return body


def _db(client):
    from app.database import SessionLocal

    return SessionLocal()


def _acme_job(db, key="interview-test-key", title="Python Backend Developer"):
    company = db.query(Company).filter_by(name_norm="acme tech").one_or_none()
    if company is None:
        company = Company(name_raw="Acme Technologies Pvt. Ltd.", name_norm="acme tech")
        db.add(company)
        db.flush()
    job = Job(
        company_id=company.id, title_raw=title, title_norm=title.lower(),
        location_raw="Hyderabad, Telangana, India", location_norm="hyderabad",
        description="Build APIs.", source_key=key,
    )
    job.company = company
    db.add(job)
    db.commit()
    return job


# -- stage detection ----------------------------------------------------


def test_detect_stages_finds_multiple_stages():
    stages = detect_stages(
        "Acme interview experience",
        "Online assessment then technical interview and HR round.")
    assert "online_assessment" in stages
    assert "technical" in stages
    assert "hr" in stages


def test_detect_stages_empty_when_no_match():
    assert detect_stages("Acme careers", "Join our team.") == []
    assert stage_label("technical") == "Technical interview"
    assert stage_label("nope") == "Interview stage"


def test_relates_to_company_filter():
    assert relates_to_company("Acme Tech interview", "technical round",
                              "https://example.com/a", "acme tech")
    assert not relates_to_company("Globex interview", "technical round",
                                  "https://example.com/g", "acme tech")
    assert not relates_to_company("t", "s", "https://example.com/a", "")


# -- enrichment + storage -----------------------------------------------


def test_enrich_stores_stage_rows_with_attribution(client):
    db, fake = _db(client), FakeSearch()
    job = _acme_job(db)
    digest = InterviewService(db, client=fake).enrich_job(job)
    rows = db.query(Evidence).filter_by(job_id=job.id).all()
    assert rows and all(r.evidence_type.startswith("interview_") for r in rows)
    assert all(r.category == "context" for r in rows)
    assert all(r.source_url and r.retrieved_at for r in rows)
    assert all(r.claim.startswith("Candidate-reported:") for r in rows)
    assert digest.state == "ok"
    assert digest.is_live is True


def test_unrelated_company_results_are_skipped(client):
    db, fake = _db(client), FakeSearch(bodies=[BODY_UNRELATED])
    job = _acme_job(db)
    digest = InterviewService(db, client=fake).enrich_job(job)
    assert digest.state == "empty"
    assert db.query(Evidence).filter_by(job_id=job.id).count() == 0


def test_reports_without_stage_mentions_store_nothing(client):
    db, fake = _db(client), FakeSearch(bodies=[BODY_NO_STAGES])
    job = _acme_job(db)
    digest = InterviewService(db, client=fake).enrich_job(job)
    assert digest.state == "empty"


def test_empty_company_makes_no_calls(client):
    db, fake = _db(client), FakeSearch()
    company = Company(name_raw="", name_norm="")
    db.add(company)
    db.flush()
    job = Job(company_id=company.id, title_raw="Role", title_norm="role",
              source_key="empty-co-key")
    job.company = company
    db.add(job)
    db.commit()
    digest = InterviewService(db, client=fake).enrich_job(job)
    assert digest.state == "empty"
    assert fake.calls == []


def test_serpapi_failure_yields_unavailable(client):
    db = _db(client)
    job = _acme_job(db)
    fake = FakeSearch(error=SerpApiError("http", "boom", 500))
    digest = InterviewService(db, client=fake).enrich_job(job)
    assert digest.state == "unavailable"


def test_second_enrich_is_idempotent_and_cached(client):
    db, fake = _db(client), FakeSearch()
    job = _acme_job(db)
    service = InterviewService(db, client=fake)
    first = service.enrich_job(job)
    calls_after_first = len(fake.calls)
    assert calls_after_first == 2  # two bounded queries
    second = service.enrich_job(job)
    assert len(fake.calls) == calls_after_first  # cache hit: zero new calls
    assert second.is_live is False
    assert db.query(Evidence).filter_by(job_id=job.id).count() == \
        db.query(Evidence).filter_by(job_id=job.id).count()
    assert first.state == second.state == "ok"


def test_stale_cache_used_on_failure(client):
    from app.models import CacheEntry
    from app.services.cache import make_key

    db = _db(client)
    job = _acme_job(db)
    params = {"q": f'"Acme Technologies Pvt. Ltd." "Python Backend Developer" interview experience',
              "gl": "in", "hl": "en"}
    past = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)
    db.add(CacheEntry(cache_key=make_key("google", params), engine="google",
                      payload=BODY_TECH, retrieved_at=past,
                      expires_at=past + dt.timedelta(hours=1)))
    db.commit()
    fake = FakeSearch(error=SerpApiError("timeout", "slow"))
    digest = InterviewService(db, client=fake).enrich_job(job)
    assert digest.state in ("ok", "stale")
    assert digest.stale is True


def test_enrich_top_is_bounded(client):
    db, fake = _db(client), FakeSearch()
    _acme_job(db, key="top-key-1")
    _acme_job(db, key="top-key-2", title="Data Analyst")
    jobs = db.query(Job).all()
    digests = InterviewService(db, client=fake, max_jobs=1).enrich_top(jobs)
    assert len(digests) == 1
    assert len(fake.calls) == 2  # 2 queries x 1 job only


def test_usage_logged_per_attempt(client):
    from app.models import ApiUsage

    db, fake = _db(client), FakeSearch()
    job = _acme_job(db)
    InterviewService(db, client=fake).enrich_job(job)
    rows = db.query(ApiUsage).filter(ApiUsage.engine == "google").all()
    assert len(rows) == 2
    assert all(r.status == "ok" and r.http_status == 200 for r in rows)
    assert all("interview" in (r.query or "") for r in rows)


# -- aggregation rules --------------------------------------------------


def test_stage_counts_use_distinct_domains_and_anecdotal_flag(client):
    db, fake = _db(client), FakeSearch()
    job = _acme_job(db)
    InterviewService(db, client=fake).enrich_job(job)
    rows = db.query(Evidence).filter_by(job_id=job.id).all()
    digest = summarize_reports(job.id, rows)
    tech = next(s for s in digest.stages if s["stage"] == "technical")
    assert tech["count"] == 2 and tech["total"] == 2
    assert tech["anecdotal"] is False
    hr = next(s for s in digest.stages if s["stage"] == "hr")
    assert hr["count"] == 1 and hr["anecdotal"] is True


def test_digest_limited_when_two_or_fewer_reports(client):
    db, fake = _db(client), FakeSearch()
    job = _acme_job(db)
    InterviewService(db, client=fake).enrich_job(job)
    digest = summarize_reports(job.id, db.query(Evidence).filter_by(job_id=job.id).all())
    assert digest.total_reports == 2
    assert digest.limited is True


def test_sentence_format_counts_reports():
    view = display_dict(summarize_reports(1, []))
    assert view["state"] == "empty"
    assert view["disclaimer"] == INTERVIEW_DISCLAIMER
    assert "not official company policy" in INTERVIEW_DISCLAIMER


def test_display_sentence_format():
    from app.services.interview import InterviewDigest
    digest = InterviewDigest(
        job_id=1, state="ok",
        stages=[{"stage": "technical", "label": "Technical interview",
                 "count": 2, "total": 3, "anecdotal": False},
                {"stage": "hr", "label": "HR interview",
                 "count": 1, "total": 3, "anecdotal": True}],
        reports=[], total_reports=3, limited=False)
    view = display_dict(digest)
    assert view["stages"][0]["sentence"] == \
        "Technical interview \u2014 reported in 2 of 3 available candidate report(s)"
    assert "anecdotal" in view["stages"][1]["sentence"]


def _row(etype, category="context", url="https://example.com/page",
         claim="Candidate-reported: stage mentioned.", query="q"):
    return Evidence(
        engine="google", query=query, evidence_type=etype, claim=claim,
        category=category, source_title="Title", source_url=url,
        retrieved_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc),
    )


def test_unrenderable_source_url_dropped_from_display_but_counted():
    from app.services.interview import summarize_reports

    good = _row("interview_technical", url="https://example.com/good")
    bad = _row("interview_technical", url="not a url")
    view = display_dict(summarize_reports(1, [good, bad]))
    assert [r["url"] for r in view["reports"]] == ["https://example.com/good"]
    tech = next(s for s in view["stages"] if s["stage"] == "technical")
    assert tech["count"] == 1  # only the renderable domain counts


def test_no_official_policy_claims_anywhere(client):
    db, fake = _db(client), FakeSearch()
    job = _acme_job(db)
    InterviewService(db, client=fake).enrich_job(job)
    rows = db.query(Evidence).filter_by(job_id=job.id).all()
    blob = " ".join([r.claim for r in rows] + [r.source_title for r in rows]
                    + [INTERVIEW_DISCLAIMER]).lower()
    assert "official company policy" not in blob or "not official company policy" in blob
    for banned in ("scam", "fake", "definitely", "100%", "guaranteed legitimate"):
        assert banned not in blob


# -- routes + pages -----------------------------------------------------


def test_results_page_renders_interview_section(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    def fake_google_search(self, q, gl="in", hl="en"):
        return BODY_TECH

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_search", fake_google_search)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "SELECTION PROCESS" in response.text
    assert "candidate-reported" in response.text
    assert "available candidate report(s)" in response.text


def test_evidence_page_renders_interview_section(client):
    db, fake = _db(client), FakeSearch()
    job = _acme_job(db, key="interview-evidence-page-key")
    InterviewService(db, client=fake).enrich_job(job)
    db.commit()  # enrich_job only flushes; release the txn before HTTP client
    response = client.get(f"/jobs/{job.id}/evidence")
    assert response.status_code == 200
    assert "SELECTION PROCESS" in response.text
    assert "Inspect supporting sources" in response.text
