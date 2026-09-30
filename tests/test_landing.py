"""Landing sections, FAQ accordion, 404 page, CTA. All hermetic."""

BANNED = ("Deploy in seconds", "Zero-trust", "Live metrics", "Global CDN",
          "cal.com", "hello@example.com", "dream job", "100% legitimate",
          "definitely real", "guaranteed job")


def test_landing_how_it_works_and_pillars(client):
    html = client.get("/").text
    for step in ("Build your profile", "Search real jobs",
                 "Understand your match", "Verify before applying"):
        assert step in html
    for pillar in ("Real jobs", "Explainable matching",
                   "Evidence verification", "Career context"):
        assert pillar in html
    for banned in BANNED:
        assert banned not in html


def test_faq_accordion_markup_and_behavior(client):
    html = client.get("/").text
    assert html.count('class="faq-q"') == 9
    assert 'aria-expanded="false"' in html
    assert "nextElementSibling" in html  # one-open-at-a-time script
    for question in ("Where do the jobs come from?",
                     "How is the match score calculated?",
                     "Is the match score AI-generated?",
                     "How does SerpApi power JobSetu?"):
        assert question in html
    assert "50 + title 20" in html or "skills 50" in html


def test_serpapi_story_names_real_engines(client):
    html = client.get("/").text
    assert "Google Jobs" in html
    assert "Google Search" in html
    assert "Google News" in html
    assert "deterministic" in html


def test_cta_links_resolve(client):
    html = client.get("/").text
    assert "Ready to search smarter?" in html
    assert 'href="/profile"' in html
    assert 'href="#search-form"' in html
    assert client.get("/profile").status_code == 200


def test_unknown_route_renders_friendly_404(client):
    response = client.get("/no-such-page-here", follow_redirects=False)
    assert response.status_code == 404
    assert "Page not found." in response.text
    assert "Go home" in response.text
    assert 'href="/tools"' in response.text
    assert "Traceback" not in response.text
    assert client.get("/").status_code == 200
    assert client.get("/tools").status_code == 200


def test_api_404_stays_json(client):
    response = client.get("/api/enrich/nope?search_id=1")
    assert response.status_code == 404
    assert "detail" in response.json()
