"""Matcher tests: pure scoring, no SerpApi, minimal DB use."""

from app.models import Candidate, Job
from app.services.matcher import (
    infer_job_type,
    score_experience,
    score_job,
    score_location,
    score_skills,
    score_title,
    score_type,
)


def _candidate(**kwargs):
    base = {"name": "Demo", "experience_years": 0.0, "location": "Hyderabad",
            "preferred_role": "Python Backend Developer", "job_type_pref": "any"}
    base.update(kwargs)
    return Candidate(**base)


def _job(**kwargs):
    base = {"title_raw": "Python Backend Developer",
            "title_norm": "python backend developer",
            "location_raw": "Hyderabad", "location_norm": "hyderabad",
            "description": "Build REST APIs with Python and FastAPI."}
    base.update(kwargs)
    return Job(**base)


def test_perfect_match_scores_100():
    result = score_job(
        _candidate(), {"python", "fastapi", "postgresql"},
        _job(description="Freshers welcome. Build REST APIs with Python."),
        ["python", "fastapi", "postgresql"], "Python Backend Developer",
    )
    assert result.total == 100
    assert (result.skill_pts, result.title_pts, result.exp_pts,
            result.loc_pts, result.type_pts) == (50, 20, 15, 10, 5)
    assert result.missing == [] and result.limited == []


def test_partial_match_and_gap():
    result = score_job(
        _candidate(), {"python", "fastapi", "postgresql", "git"},
        _job(), ["python", "fastapi", "postgresql", "docker", "redis"],
        "Python Backend Developer",
    )
    assert result.skill_pts == 30  # 3/5 of 50
    assert result.matched == ["python", "fastapi", "postgresql"]
    assert result.missing == ["docker", "redis"]
    assert result.total == 30 + 20 + 10 + 10 + 5  # exp neutral: no signal in listing


def test_zero_overlap_and_reproducibility():
    first = score_job(_candidate(), {"git"}, _job(),
                      ["python", "docker"], "Python Backend Developer")
    second = score_job(_candidate(), {"git"}, _job(),
                       ["python", "docker"], "Python Backend Developer")
    assert first.skill_pts == 0
    assert first.total == second.total == 0 + 20 + 10 + 10 + 5


def test_missing_job_skills_is_neutral_limited():
    pts, matched, missing, reasons, limited = score_skills({"python"}, [])
    assert pts == 25 and limited == ["skills-limited"]
    assert "provisional" in reasons[0]


def test_title_scoring():
    pts, _ = score_title("Python Backend Developer", "python backend developer")
    assert pts == 20
    pts, _ = score_title("Python Backend Developer", "backend engineer")
    assert pts == round(20 / 3)
    pts, _ = score_title("Python Backend Developer", "staff nurse")
    assert pts == 0


def test_experience_scoring():
    assert score_experience(0.0, "python developer", "freshers welcome")[0] == 15
    # senior title without explicit years: fresher scores 0
    pts, reasons, _ = score_experience(0.0, "senior python developer", "lead the team")
    assert pts == 0
    # explicit minimum takes precedence when present
    pts, _, _ = score_experience(0.0, "senior python developer", "5+ years needed")
    assert pts == 3
    pts, _, limited = score_experience(0.0, "python developer", "build apis")
    assert pts == 10 and limited == ["experience-unclear"]
    pts, _, _ = score_experience(4.0, "python developer", "minimum 3 years")
    assert pts == 15


def test_location_scoring():
    assert score_location("Hyderabad", _job())[0] == 10
    assert score_location("Hyderabad", _job(location_norm="bengaluru",
                                            location_raw="Bengaluru"))[0] == 0
    remote = _job(location_norm="remote india", location_raw="Remote")
    assert score_location("Hyderabad", remote)[0] == 7
    pts, _, limited = score_location("Hyderabad", _job(location_norm=""))
    assert pts == 5 and limited == ["location-unknown"]


def test_type_scoring_and_inference():
    assert infer_job_type("Intern", "6 month internship") == "internship"
    assert infer_job_type("Dev", "full-time role") == "full-time"
    assert infer_job_type("Dev", "build apis") == ""
    assert score_type("any", _job())[0] == 5
    pts, _, limited = score_type("full-time", _job())
    assert pts == 3 and limited == ["type-unknown"]
    assert score_type("contract", _job(description="12 month contract"))[0] == 5
    assert score_type("full-time", _job(description="12 month contract"))[0] == 0
