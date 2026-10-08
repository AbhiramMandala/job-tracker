"""Candidate profile. Single local profile, no auth (MVP)."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.data.skills import display_skill, normalize_skill
from app.database import get_db
from app.models import Candidate, CandidateSkill

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory="app/templates")
router = APIRouter()

EXPERIENCE_CHOICES = ["Fresher", "0–1 years", "1–2 years", "3+ years"]
EXPERIENCE_YEARS = {"Fresher": 0.0, "0–1 years": 0.5, "1–2 years": 1.5, "3+ years": 4.0}
TYPE_CHOICES = ["any", "full-time", "part-time", "contract", "internship"]

DEMO_PROFILE = {
    "name": "Demo Fresher",
    "preferred_role": "Python Backend Developer",
    "location": "Hyderabad",
    "experience": "Fresher",
    "job_type_pref": "any",
    "skills": "Python, FastAPI, Django, PostgreSQL, Git",
}


def get_active_candidate(db: Session) -> Candidate | None:
    return (
        db.query(Candidate)
        .filter_by(is_active=True)
        .order_by(Candidate.id)
        .first()
    )


def parse_skills(raw: str) -> list[str]:
    """Split on commas/newlines, normalize, dedupe (order-preserving)."""
    seen: dict[str, None] = {}
    for chunk in (raw or "").replace("\n", ",").split(","):
        norm = normalize_skill(chunk)
        if norm and norm not in seen:
            seen[norm] = None
    return list(seen)[:50]


@router.get("/profile", response_class=HTMLResponse)
def edit_profile(request: Request, db: Session = Depends(get_db)):
    candidate = get_active_candidate(db)
    demo = request.query_params.get("demo") == "1"
    saved = request.query_params.get("saved") == "1"
    if candidate is None:
        current = dict(DEMO_PROFILE) if demo else {
            "name": "", "preferred_role": "Python Backend Developer",
            "location": "Hyderabad", "experience": "Fresher",
            "job_type_pref": "any", "skills": "",
        }
        skill_norms: list[str] = parse_skills(current["skills"])
    else:
        current = {
            "name": candidate.name,
            "preferred_role": candidate.preferred_role,
            "location": candidate.location,
            "experience": _level_for_years(candidate.experience_years or 0.0),
            "job_type_pref": candidate.job_type_pref or "any",
            "skills": "",
        }
        skill_norms = [
            row.skill_norm
            for row in db.query(CandidateSkill)
            .filter_by(candidate_id=candidate.id)
            .order_by(CandidateSkill.id)
            .all()
        ]
        if demo:  # explicit sample refill, clearly labeled, not yet saved
            current = dict(DEMO_PROFILE)
            skill_norms = parse_skills(current["skills"])
    return templates.TemplateResponse(
        request, "profile.html",
        {
            "current": current,
            "skills": [(s, display_skill(s)) for s in skill_norms],
            "experience_choices": EXPERIENCE_CHOICES,
            "type_choices": TYPE_CHOICES,
            "demo": demo,
            "saved": saved,
            "error": None,
        },
    )


@router.post("/profile")
async def save_profile(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    name = str(form.get("name") or "").strip()[:200]
    preferred_role = str(form.get("preferred_role") or "").strip()[:200]
    location = str(form.get("location") or "").strip()[:200]
    experience = str(form.get("experience") or "Fresher")
    job_type_pref = str(form.get("job_type_pref") or "any").lower()
    skills = parse_skills(str(form.get("skills") or ""))
    error = _validate(preferred_role, location, experience, job_type_pref, skills)
    if error is not None:
        return templates.TemplateResponse(
            request, "profile.html",
            {
                "current": {
                    "name": name, "preferred_role": preferred_role,
                    "location": location, "experience": experience,
                    "job_type_pref": job_type_pref,
                    "skills": str(form.get("skills") or ""),
                },
                "skills": [(s, display_skill(s)) for s in skills],
                "experience_choices": EXPERIENCE_CHOICES,
                "type_choices": TYPE_CHOICES,
                "demo": False, "saved": False, "error": error,
            },
            status_code=400,
        )
    candidate = get_active_candidate(db)
    if candidate is None:
        candidate = Candidate(is_active=True)
        db.add(candidate)
        db.flush()
    candidate.name = name or "Fresher"
    candidate.preferred_role = preferred_role
    candidate.location = location
    candidate.experience_years = EXPERIENCE_YEARS[experience]
    candidate.job_type_pref = job_type_pref
    db.query(CandidateSkill).filter_by(candidate_id=candidate.id).delete()
    for norm in skills:
        db.add(CandidateSkill(candidate_id=candidate.id, skill_norm=norm, source="pasted"))
    db.commit()
    logger.info("profile saved candidate=%s skills=%d", candidate.id, len(skills))
    return RedirectResponse(url="/profile?saved=1", status_code=303)


def _validate(
    preferred_role: str, location: str, experience: str, job_type_pref: str, skills: list[str]
) -> str | None:
    if not preferred_role:
        return "Preferred role must not be empty."
    if not location:
        return "Location must not be empty."
    if experience not in EXPERIENCE_YEARS:
        return "Choose a valid experience level."
    if job_type_pref not in TYPE_CHOICES:
        return "Choose a valid employment-type preference."
    if not skills:
        return "Add at least one skill."
    return None


def _level_for_years(years: float) -> str:
    if years <= 0:
        return "Fresher"
    if years <= 1:
        return "0–1 years"
    if years <= 2:
        return "1–2 years"
    return "3+ years"
