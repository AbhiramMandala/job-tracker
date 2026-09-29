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
    assert out["type"] == "Government / PSU"
    assert out["confidence"] == "High"
    assert "nic.in" in out["basis"]


def test_established_employer_needs_official_plus_corrobation():
    rows = [_site_row("https://acmetechnologies.com/"),
            _row("company_presence", "https://en.wikipedia.org/wiki/Acme"),
            _row("company_presence", "https://linkedin.com/company/acme"),
            _row("company_presence", "https://crunchbase.com/acme")]
    out = classify_company_type("acme tech", "Acme Tech", rows)
    assert out["type"] == "Established employer"
    assert out["confidence"] == "Moderate"
    assert "corroborating domains" in out["basis"]


def test_private_company_fallback_when_evidence_thin():
    out = classify_company_type("acme tech", "Acme Tech", [])
    assert out["type"] == "Private Company"
    assert out["confidence"] == "Low"
    assert "private-sector default" in out["basis"]
    assert classify_company_type("", "", [])["type"] == "Private Company"


def test_filter_values():
    assert filter_value({"type": "Government / PSU"}) == "government"
    assert filter_value({"type": "Established employer"}) == "established"
    assert filter_value({"type": "Private Company"}) == "private"
    assert filter_value({"type": "Weird"}) == "private"
    assert filter_value({}) == "private"
    assert filter_value(None) == "private"


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
    assert 'rel="noopener noreferrer"' in html
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
    assert "insufficient evidence" in html  # classification basis shown
    assert "Official website" in html
    assert "Python" in html  # skill chip label
    assert "PREPARE FOR THIS ROLE" in html
    assert "Practice in Useful Tools" in html
    assert "View sources" in html


def test_tools_search_preset_from_query_string(client):
    html = client.get("/tools").text
    assert "URLSearchParams" in html


def test_every_resource_has_valid_trust_label():
    from app.data.resources import TRUST, valid_resources

    assert set(TRUST.values()) <= {
        "Official", "Established Resource", "Community Resource", "External Tool",
    }
    assert all(res["trust"] for res in valid_resources())


# -- private-company fallback -------------------------------------------


def test_normalize_company_type_variants():
    from app.services.company import normalize_company_type

    for variant in ("private_company", "Private Company", "private company",
                    "PRIVATE_COMPANY", "  Private_Company  "):
        assert normalize_company_type(variant) == {
            "type": "Private Company", "filter": "private"}
    assert normalize_company_type("government / psu") == {
        "type": "Government / PSU", "filter": "government"}
    assert normalize_company_type("nonsense") == {
        "type": "Private Company", "filter": "private"}
    assert normalize_company_type(None) == {
        "type": "Private Company", "filter": "private"}


def test_specific_types_never_become_private():
    gov = classify_company_type("municipal corporation", "Municipal Corp", [])
    assert gov["type"] == "Government / PSU"
    for name in ("Acme Startup Labs", "Global MNC Services", "Helping Hands NGO",
                 "Infosys", "Small Shop"):
        out = classify_company_type(name.lower(), name, [])
        assert out["type"] not in ("Startup", "MNC", "Non-profit",
                                   "Large Indian Company", "Mid-size Company")


def test_filter_shows_private_company_not_unknown(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    html = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    ).text
    assert '<option value="private">Private Company</option>' in html
    assert ">Unknown</option>" not in html
    assert 'data-company-type="private"' in html
    assert "Company type: Private Company" in html


def test_role_intelligence_shows_private_company(client):
    from app.database import SessionLocal
    from app.models import Company, Job

    db = SessionLocal()
    company = Company(name_raw="Acme Tech", name_norm="acme tech")
    db.add(company)
    db.flush()
    job = Job(company_id=company.id, title_raw="Dev", title_norm="dev",
              location_raw="Hyderabad", location_norm="hyderabad",
              source_key="private-co-intel-key")
    job.company = company
    db.add(job)
    db.commit()
    html = client.get(f"/jobs/{job.id}/evidence").text
    assert "Private Company" in html
    assert "Confidence: Low" in html
