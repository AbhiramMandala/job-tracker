"""Design-system + resources-polish tests. All hermetic."""

from app.data.resources import TRUST, valid_resources


VALID_TRUST = {"Official", "Established Resource", "Community Resource",
               "External Tool"}


def test_every_resource_has_valid_trust_label():
    resources = valid_resources()
    assert len(resources) == 29
    for res in resources:
        assert res["trust"] in VALID_TRUST
    assert set(TRUST.values()) <= VALID_TRUST


def test_trust_rendered_without_endorsement_claims(client):
    html = client.get("/tools").text
    assert "Official" in html
    assert "not a quality guarantee" in html
    for banned in ("Verified by JobSetu", "Official Notion",
                   "Recommended by Notion"):
        assert banned not in html


def test_category_counts_in_filter(client):
    html = client.get("/tools").text
    assert "Interview Preparation (12)" in html
    assert "Developer Tools (8)" in html
    assert "Resume / Career (5)" in html
    assert "Company Research (3)" in html
    assert "Job Search (1)" in html
    assert "All categories (29)" in html


def test_external_links_open_safely(client):
    html = client.get("/tools").text
    assert 'target="_blank"' in html
    assert 'rel="noopener noreferrer"' in html
    assert "Why useful for JobSetu:" in html
    assert "Open resource" in html


def test_match_bar_renders_with_numeric_width(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    def fake_search(self, q, gl="in", hl="en"):
        return {"organic_results": []}

    def fake_news(self, q, gl="in", hl="en"):
        return {"news_results": []}

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    monkeypatch.setattr(client_module.SerpApiClient, "google_search", fake_search)
    monkeypatch.setattr(client_module.SerpApiClient, "google_news", fake_news)
    # A profile is required for match scores (and the match bar) to render.
    client.post(
        "/profile",
        data={"name": "Tester", "experience": "Fresher",
              "preferred_role": "Python Backend Developer",
              "location": "Hyderabad", "job_type_pref": "any",
              "skills": "Python, FastAPI"},
    )
    html = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    ).text
    assert "match-bar" in html
    assert 'aria-label="' in html
    import re

    widths = [int(w) for w in re.findall(r"width: (\d+)%", html)]
    assert widths and all(0 <= w <= 100 for w in widths)


def test_landing_rotator_is_decorative_and_motion_safe(client):
    html = client.get("/").text
    assert 'id="rotate-word"' in html
    assert 'aria-hidden="true"' in html
    assert "prefers-reduced-motion" in html
    assert "Verify opportunities." in html


def test_design_tokens_and_sticky_header(client):
    css = client.get("/static/style.css").text
    for token in ("--space-4", "--radius-md", "--shadow-md",
                  "--duration-normal", "--font-h2"):
        assert token in css
    assert "position: sticky" in css
    assert ".match-bar" in css
    assert ".table-scroll" in css


def test_whois_wording_makes_no_legitimacy_claim():
    whois = next(r for r in valid_resources() if r["name"] == "WHOIS Lookup")
    blob = (whois["description"] + " " + whois["why"]).lower()
    assert "legitimate" not in blob
    assert "belongs to the employer" not in blob
    assert "domain" in blob
