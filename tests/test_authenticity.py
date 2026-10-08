"""Authenticity analyzer tests. All hermetic: pure-function checks plus
route tests over the temp DB. No network, no SerpApi calls, no key needed."""

import datetime as dt

from app.models import Company, Evidence, Job
from app.services.authenticity import (
    DISCLAIMER,
    analyze_job,
    display_dict,
    level_for,
)


def _company(raw="Acme Technologies Pvt. Ltd.", norm="acme tech"):
    return Company(name_raw=raw, name_norm=norm)


def _job(company=None, **kwargs):
    base = {
        "title_raw": "Python Backend Developer",
        "title_norm": "python backend developer",
        "location_raw": "Hyderabad, Telangana, India",
        "location_norm": "hyderabad",
        "description": "Build REST APIs with Python and Django.",
        "apply_link": "https://acmetechnologies.com/careers/123",
        "salary_text": "",
        "source_key": "auth-test-key",
    }
    base.update(kwargs)
    job = Job(company_id=1, **base)
    job.company = company
    return job


def _row(etype, category="supporting", url="https://example.com/page",
         claim="Claim.", query="q"):
    return Evidence(
        engine="google", query=query, evidence_type=etype, claim=claim,
        category=category, source_title="Title", source_url=url,
        retrieved_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc),
    )


def _strong_rows():
    return [
        _row("company_website", url="https://acmetechnologies.com/"),
        _row("company_presence", url="https://en.wikipedia.org/wiki/Acme"),
        _row("company_presence", url="https://linkedin.com/company/acme"),
        _row("job_presence", url="https://acmetechnologies.com/careers/123"),
        _row("location_presence", url="https://hyderabadbiz.com/acme"),
    ]


def _texts(report):
    return ([s.text for s in report.signals] + report.contradictions
            + [report.level_label])


# -- core behavior ------------------------------------------------------


def test_strong_legitimate_evidence_scores_high():
    report = analyze_job(_job(), _strong_rows(), news_ok=True)
    assert report.evidence_available is True
    assert report.score >= 75
    assert report.level in ("strong", "higher")
    assert sum(report.category_scores.values()) == report.score


def test_missing_company_evidence_marks_unverifiable():
    job = _job()
    job.company = None
    report = analyze_job(job, [])
    assert report.category_scores["company_verification"] == 0
    assert any("no company information" in s.text for s in report.signals)


def test_official_domain_apply_link_is_supported():
    report = analyze_job(_job(), _strong_rows())
    assert any("official domain" in s.text for s in report.signals)
    assert report.category_scores["application_signals"] >= 17


def test_free_email_recruiter_is_risk_signal_not_verdict():
    clean = analyze_job(_job(), _strong_rows())
    risky = analyze_job(
        _job(description="Send resume to hr.recruiter@gmail.com for this role."),
        _strong_rows(),
    )
    assert any("free email" in c for c in risky.contradictions)
    assert risky.category_scores["application_signals"] < clean.category_scores["application_signals"]
    assert "scam" not in " ".join(_texts(risky)).lower()


def test_whatsapp_signal():
    report = analyze_job(
        _job(description="Apply on WhatsApp 98xxxxxx01 with your resume."), _strong_rows())
    assert any("WhatsApp" in c for c in report.contradictions)


def test_telegram_signal():
    report = analyze_job(
        _job(description="Message us on Telegram @acmejobs to apply."), _strong_rows())
    assert any("Telegram" in c for c in report.contradictions)


def test_payment_request_reduces_content_score():
    clean = analyze_job(_job(), _strong_rows())
    risky = analyze_job(
        _job(description="Pay a refundable security deposit of Rs 2000 to confirm."),
        _strong_rows(),
    )
    assert any("rarely charge" in c for c in risky.contradictions)
    assert risky.category_scores["content_risk"] < clean.category_scores["content_risk"]


def test_unrealistic_salary_guarantee_and_no_interview():
    report = analyze_job(
        _job(description="Guaranteed income of Rs 80000 per week. No interview needed. Urgent hiring, apply immediately, limited slots.",
             salary_text="80,000 per week"),
        _strong_rows(),
    )
    assert any("guaranteed income" in c for c in report.contradictions)
    assert any("no interview" in c for c in report.contradictions)
    assert report.category_scores["content_risk"] <= 20 - 5 - 4


def test_conflicting_location_is_contradiction():
    rows = [_row("company_presence", url="https://example.com/a")]
    report = analyze_job(_job(), rows)
    assert any("could not be independently confirmed" in c for c in report.contradictions)


def test_multiple_corroborating_sources_boost_consistency():
    rows = [
        _row("company_presence", url="https://site-one.com/a"),
        _row("job_presence", url="https://site-two.com/b"),
        _row("company_presence", url="https://site-three.com/c"),
    ]
    report = analyze_job(_job(), rows)
    assert any("corroborated across 3 independent sites" in s.text for s in report.signals)


def test_no_evidence_caps_score_and_says_so():
    report = analyze_job(_job(apply_link=""), [])
    assert report.evidence_available is False
    assert report.score <= 49
    assert any("capped until evidence exists" in s.text for s in report.signals)


def test_serpapi_unavailable_shape_is_honest_low_report():
    job = _job(company=None, description="", apply_link="", source_key="bare-key")
    report = analyze_job(job, [])
    assert report.evidence_available is False
    assert report.score <= 49
    assert report.disclaimer == DISCLAIMER


def test_cached_evidence_counts_regardless_of_age():
    fresh = _strong_rows()
    stale = _strong_rows()
    ancient = dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc)
    for row in stale:
        row.retrieved_at = ancient
    assert analyze_job(_job(), fresh).score == analyze_job(_job(), stale).score


# -- score contract -----------------------------------------------------


def test_score_bounds_and_category_caps():
    worst = analyze_job(
        _job(company=None, description="WhatsApp us. Telegram too. Pay training fee now. Guaranteed income, no interview!",
             apply_link="http://shady-apply.xyz/form", salary_text="50 lakh per month",
             source_key="worst-key"),
        [_row("warning_signal", category="warning", url="", claim="No independent search presence found.")],
    )
    best = analyze_job(_job(), _strong_rows(), news_ok=True)
    for report in (worst, best):
        assert 0 <= report.score <= 100
        for key, maximum in (("company_verification", 25), ("job_consistency", 25),
                             ("application_signals", 20), ("content_risk", 20),
                             ("independent_evidence", 10)):
            assert 0 <= report.category_scores[key] <= maximum


def test_deterministic_scoring():
    job, rows = _job(), _strong_rows()
    assert analyze_job(job, rows, news_ok=True).to_dict() == \
        analyze_job(job, rows, news_ok=True).to_dict()


def test_level_bands():
    assert level_for(95) == ("strong", "Strong supporting evidence")
    assert level_for(80) == ("higher", "Higher confidence")
    assert level_for(60)[0] == "mixed"
    assert level_for(30)[0] == "significant"
    assert level_for(10)[0] == "high"


def test_disclaimer_present_and_no_forbidden_verdicts():
    reports = [
        analyze_job(_job(), _strong_rows(), news_ok=True),
        analyze_job(_job(description="Pay training fee. WhatsApp only."), []),
    ]
    for report in reports:
        assert report.disclaimer == DISCLAIMER
        assert "not a guarantee" in report.disclaimer
        blob = " ".join(_texts(report)).lower()
        assert "definitely" not in blob
        assert "100%" not in blob
        assert "scam" not in blob
        assert "fake" not in blob


def test_display_dict_matches_report():
    report = analyze_job(_job(), _strong_rows())
    view = display_dict(report)
    assert view["score"] == report.score
    assert sum(c["got"] for c in view["categories"]) == report.score
    assert view["disclaimer"] == DISCLAIMER


# -- routes (temp DB, no network) ---------------------------------------


def _db(client):
    from app.database import SessionLocal

    return SessionLocal()


def _seed_job(db, key="auth-route-key"):
    company = Company(name_raw="Acme Technologies Pvt. Ltd.", name_norm="acme tech")
    db.add(company)
    db.flush()
    job = Job(
        company_id=company.id, title_raw="Python Backend Developer",
        title_norm="python backend developer",
        location_raw="Hyderabad, Telangana, India", location_norm="hyderabad",
        description="Build REST APIs.", source_key=key,
        apply_link="https://acmetechnologies.com/careers/1",
    )
    job.company = company
    db.add(job)
    db.flush()
    for row in _strong_rows():
        row.job_id, row.company_id = job.id, company.id
        db.add(row)
    db.commit()
    return job


def test_authenticity_route_returns_structured_report(client):
    db = _db(client)
    job = _seed_job(db)
    response = client.get(f"/jobs/{job.id}/authenticity")
    assert response.status_code == 200
    body = response.json()
    assert body["score"] >= 75
    assert set(body) >= {"score", "level", "level_label", "category_scores",
                         "signals", "contradictions", "evidence_available",
                         "disclaimer"}
    assert sum(body["category_scores"].values()) == body["score"]
    assert body["evidence_available"] is True
    assert body["disclaimer"] == DISCLAIMER


def test_authenticity_route_404_for_unknown_job(client):
    response = client.get("/jobs/999999/authenticity")
    assert response.status_code == 404
    assert "detail" in response.json()


def test_results_page_renders_authenticity_panel(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "JOB AUTHENTICITY" in response.text
    assert "evidence-based risk indicator" in response.text


def test_evidence_page_renders_authenticity_panel(client):
    db = _db(client)
    job = _seed_job(db, key="auth-evidence-page-key")
    response = client.get(f"/jobs/{job.id}/evidence")
    assert response.status_code == 200
    assert "JOB AUTHENTICITY" in response.text
    assert "Why this score?" in response.text
