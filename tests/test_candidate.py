"""Candidate profile route tests + search/match integration (SerpApi mocked)."""

from app.models import Candidate, CandidateSkill
from app.routes.profile import parse_skills


def _db(client):
    from app.database import SessionLocal

    return SessionLocal()


def test_parse_skills_normalizes_and_dedupes():
    assert parse_skills("Python, python,  PYTHON\nFast API") == ["python", "fastapi"]
    assert parse_skills("") == []
    assert parse_skills("Postgres") == ["postgresql"]


def test_profile_page_renders(client):
    response = client.get("/profile")
    assert response.status_code == 200
    assert "Your profile" in response.text


def test_demo_prefill_is_labeled_sample(client):
    response = client.get("/profile?demo=1")
    assert response.status_code == 200
    assert "sample demo data" in response.text
    assert "FastAPI" in response.text or "fastapi" in response.text
    # prefill only: nothing persisted until submit
    assert _db(client).query(Candidate).count() == 0


def test_save_profile_persists_normalized_skills(client):
    response = client.post(
        "/profile",
        data={
            "name": "Demo Fresher",
            "preferred_role": "Python Backend Developer",
            "location": "Hyderabad",
            "experience": "Fresher",
            "job_type_pref": "any",
            "skills": "Python, python, Fast API,  Django ",
        },
        follow_redirects=False,
    )
    assert response.status_code == 303
    db = _db(client)
    candidate = db.query(Candidate).one()
    assert (candidate.preferred_role, candidate.location) == (
        "Python Backend Developer", "Hyderabad")
    norms = sorted(
        r.skill_norm for r in db.query(CandidateSkill).filter_by(candidate_id=candidate.id)
    )
    assert norms == ["django", "fastapi", "python"]


def test_save_profile_validation(client):
    bad = client.post(
        "/profile",
        data={"name": "", "preferred_role": "", "location": "Hyderabad",
              "experience": "Fresher", "job_type_pref": "any", "skills": "Python"},
    )
    assert bad.status_code == 400
    empty_skills = client.post(
        "/profile",
        data={"name": "", "preferred_role": "Dev", "location": "Hyderabad",
              "experience": "Fresher", "job_type_pref": "any", "skills": "  "},
    )
    assert empty_skills.status_code == 400
    assert _db(client).query(Candidate).count() == 0


def test_resave_syncs_skills(client):
    first = {
        "name": "", "preferred_role": "Dev", "location": "Hyderabad",
        "experience": "Fresher", "job_type_pref": "any", "skills": "Python, Git",
    }
    client.post("/profile", data=first)
    client.post("/profile", data={**first, "skills": "Python, Docker"})
    db = _db(client)
    assert db.query(Candidate).count() == 1
    norms = sorted(
        r.skill_norm for r in db.query(CandidateSkill).all()
    )
    assert norms == ["docker", "python"]  # git removed, no duplicates


def test_search_renders_scores_and_gaps_with_profile(client, monkeypatch):
    from app.services import serpapi_client as client_module
    from tests._fixtures import EMPTY, PAGE_1

    def fake_google_jobs(self, q, location, gl="in", hl="en", next_page_token=""):
        return PAGE_1 if not next_page_token else EMPTY

    monkeypatch.setattr(client_module.SerpApiClient, "google_jobs", fake_google_jobs)
    client.post(
        "/profile",
        data={"name": "Demo Fresher", "preferred_role": "Python Backend Developer",
              "location": "Hyderabad", "experience": "Fresher",
              "job_type_pref": "any",
              "skills": "Python, FastAPI, Django, PostgreSQL, Git"},
    )
    response = client.post(
        "/search",
        data={"role": "Python Backend Developer", "location": "Hyderabad",
              "experience": "Fresher"},
    )
    assert response.status_code == 200
    assert "78% MATCH" in response.text  # deterministic: 33+20+10+10+5
    assert "Skill gap" in response.text
    assert "WHY THIS MATCHES" in response.text
    assert "What should I learn next?" in response.text
    assert "2 listings found" not in response.text
    assert "duplicates removed" in response.text


def test_search_without_profile_shows_nudge_not_scores(client, monkeypatch):
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
    assert "Create your profile" in response.text
    assert "% MATCH" not in response.text
    assert "Detected skills" in response.text  # intelligence visible regardless
    # no key in this environment: VERIFY honestly reports unavailability
    assert "Verification unavailable" in response.text
