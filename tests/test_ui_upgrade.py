"""UI upgrade tests: theme system, company classification, prep topics,
resources page, card attributes, role-intelligence blocks. All hermetic."""

from app.data.resources import CATEGORIES, RESOURCES, valid_resources
from app.services.company import classify_company_type, filter_value
from app.services.interview import derive_prep_topics


def _row(etype, url, title="Report title", snippet="Technical interview about Python."):
    import datetime as dt

    from app.models import Evidence

    return Evidence(
        engine="google", query="q", evidence_type=etype,
        claim="Candidate-reported: stage mentioned.", category="context",
        source_title=title, source_url=url, source_snippet=snippet,
        retrieved_at=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc),
    )


# -- theme system -------------------------------------------------------


def test_base_has_accessible_theme_toggle(client):
    html = client.get("/").text
    assert 'id="theme-toggle"' in html
    assert "<button" in html
    assert 'aria-label="Switch to dark theme"' in html
    assert 'aria-pressed="false"' in html


def test_theme_bootstraps_before_paint_without_flash(client):
    html = client.get("/").text
    assert "jobsetu-theme" in html
    assert "prefers-color-scheme" in html
    assert 'data-theme' in html
    assert "/static/theme.js" in html


def test_theme_js_served_and_persists(client):
    response = client.get("/static/theme.js")
    assert response.status_code == 200
    assert "localStorage" in response.text
    assert "data-theme" in response.text
    assert "aria-pressed" in response.text


def test_stylesheet_has_dark_tokens_and_motion_safety(client):
    css = client.get("/static/style.css").text
    assert '[data-theme="dark"]' in css
    assert "prefers-reduced-motion" in css
    assert ":focus-visible" in css
    for token in ("--bg", "--card", "--ink", "--accent", "--border"):
        assert token in css


def test_skip_link_and_nav_present(client):
    html = client.get("/").text
    assert 'href="#main"' in html
    assert 'id="main"' in html
    assert 'href="/tools"' in html


# -- company classification ---------------------------------------------


def _site_row(url):
    return _row("company_website", url)


def test_government_classification_high_confidence():
    out = classify_company_type(
        "national informatics centre", "National Informatics Centre",
        [_site_row("https://www.nic.in/")])
    assert out == {"type": "Government / PSU", "confidence": "High"}


def test_established_employer_needs_official_plus_corrobation():
    rows = [_site_row("https://acmetechnologies.com/"),
            _row("company_presence", "https://en.wikipedia.org/wiki/Acme"),
            _row("company_presence", "https://linkedin.com/company/acme"),
            _row("company_presence", "https://crunchbase.com/acme")]
    out = classify_company_type("acme tech", "Acme Tech", rows)
    assert out == {"type": "Established employer", "confidence": "Moderate"}


def test_unknown_when_evidence_thin():
    assert classify_company_type("acme tech", "Acme Tech", []) == \
        {"type": "Unknown", "confidence": "Low"}
    assert classify_company_type("", "", [])["confidence"] == "Low"


def test_filter_values():
    assert filter_value({"type": "Government / PSU"}) == "government"
    assert filter_value({"type": "Established employer"}) == "established"
    assert filter_value({"type": "Unknown"}) == "unknown"
    assert filter_value({"type": "Weird"}) == "unknown"


# -- prep topics --------------------------------------------------------


def test_prep_topics_count_reports_and_listing_overlap():
    rows = [_row("interview_technical", "https://a.example/r1",
                 snippet="Python and SQL technical interview."),
            _row("interview_technical", "https://b.example/r2",
                 snippet="SQL joins and Python OOP questions.")]
    topics = derive_prep_topics("We need Python and Docker skills.", rows)
    by_skill = {t["skill"]: t for t in topics}
    assert by_skill["python"]["reports"] == 2
    assert by_skill["python"]["in_listing"] is True
    assert by_skill["sql"]["reports"] == 2
    assert by_skill["sql"]["in_listing"] is False
    assert by_skill["sql"]["pointers"], "known skills get starting points"


def test_prep_topics_empty_without_evidence():
    assert derive_prep_topics("Python role.", []) == []


def test_prep_topics_capped_and_sorted():
    rows = [_row("interview_technical", f"https://{c}.example/r",
                 snippet="Python SQL Java Go Rust Kotlin Swift")
            for c in ("a", "b", "c")]
    topics = derive_prep_topics("", rows, top_n=3)
    assert len(topics) == 3
    counts = [t["reports"] for t in topics]
    assert counts == sorted(counts, reverse=True)


# -- resources ----------------------------------------------------------


def test_resources_valid_shape():
    assert len(valid_resources()) == len(RESOURCES)
    for res in valid_resources():
        assert res["url"].startswith("https://")
        assert res["category"] in CATEGORIES
        assert res["name"] and res["description"]


def test_tools_page_renders_with_filters(client):
    html = client.get("/tools").text
    assert "Useful tools" in html
    assert 'id="tool-q"' in html
    assert 'id="tool-cat"' in html
    assert 'target="_blank"' in html
    assert 'rel="noopener"' in html
    for res in valid_resources():
        assert res["name"] in html


# -- cards + filters ----------------------------------------------------


def _search(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    def fake_google_search(self, q, gl="in", hl="en"):
        return {"organic_results": []}

    def fake_google_news(self, q, gl="in", hl="en"):
        return {"news_results": []}

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_search", fake_google_search)
    monkeypatch.setattr(client_module.SerpApiClient, "google_news", fake_google_news)
    return client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )


def test_cards_carry_filter_attributes_and_company_line(client, monkeypatch):
    html = _search(client, monkeypatch).text
    assert "job-card" in html
    assert "data-verify=" in html
    assert "data-company-type=" in html
    assert "Company type:" in html
    assert "Confidence:" in html
    assert 'id="filter-verify"' in html
    assert 'id="filter-company"' in html
    assert "View role intelligence" in html


def test_index_has_staged_loading_and_filter_note(client):
    html = client.get("/").text
    assert "Searching live job data" in html
    assert "Checking supporting evidence" in html
    assert "More filters" in html


# -- role intelligence page ---------------------------------------------


def test_evidence_page_role_intelligence_blocks(client):
    from app.database import SessionLocal
    from app.models import Company, Job, JobSkill

    db = SessionLocal()
    company = Company(name_raw="Acme Technologies Pvt. Ltd.", name_norm="acme tech")
    db.add(company)
    db.flush()
    job = Job(
        company_id=company.id, title_raw="Python Backend Developer",
        title_norm="python backend developer",
        location_raw="Hyderabad, Telangana, India", location_norm="hyderabad",
        description="Build REST APIs with Python and Django.",
        posted_text="2 days ago", salary_text="6-10 LPA",
        via='["Indeed"]', source_key="ui-intel-key-2",
        apply_link="https://acmetechnologies.com/careers/1",
    )
    job.company = company
    db.add(job)
    db.flush()
    db.add(JobSkill(job_id=job.id, skill_norm="python"))
    for row in (_row("company_website", "https://acmetechnologies.com/"),
                _row("interview_technical", "https://a.example/r1",
                     snippet="Python OOP technical interview.")):
        row.job_id, row.company_id = job.id, company.id
        db.add(row)
    db.commit()

    html = client.get(f"/jobs/{job.id}/evidence").text
    assert "Company type" in html
    assert "Confidence:" in html
    assert "Official website" in html
    assert "Python" in html  # skill chip label
    assert "PREPARE FOR THIS ROLE" in html
    assert "View sources" in html
