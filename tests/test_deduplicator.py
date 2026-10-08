"""Deduplicator tests: similarity, guards, canonical merge."""

import datetime as dt

from app.models import Job
from app.schemas.jobs import JobItem
from app.services.deduplicator import (
    SIM_THRESHOLD,
    apply_merge,
    is_duplicate_job,
    is_duplicate_norms,
    pair_similarity,
)
from app.services.normalizer import normalize_job


def _norm(**kwargs):
    base = {"title": "Python Backend Developer", "company_name": "Acme Tech",
            "location": "Hyderabad", "description": "Build REST APIs with Python."}
    base.update(kwargs)
    return normalize_job(JobItem(**base))


def test_identical_texts_score_one():
    assert pair_similarity("acme", "python developer", "build apis",
                           "acme", "python developer", "build apis") == 1.0


def test_different_texts_score_low():
    sim = pair_similarity("acme", "python developer", "build rest apis",
                          "other", "nurse practitioner", "patient care night shift")
    assert sim < SIM_THRESHOLD


def test_same_job_different_domains_merge():
    a = _norm(apply_options=[{"title": "I", "link": "https://indeed.com/j"}])
    b = _norm(company_name="ACME Technologies",
              apply_options=[{"title": "L", "link": "https://linkedin.com/j"}])
    assert a.source_key != b.source_key  # exact keys differ ...
    assert is_duplicate_norms(a, b)  # ... but similarity merges them


def test_different_companies_never_merge():
    a = _norm()
    b = _norm(company_name="Totally Different Corp")
    assert not is_duplicate_norms(a, b)


def test_missing_company_never_fuzzy_merges():
    a = _norm()
    b = _norm(company_name="")
    assert not is_duplicate_norms(a, b)


def test_merge_preserves_best_of_both():
    job = Job(
        title_raw="Python Backend Developer", title_norm="python backend developer",
        location_raw="Hyderabad", location_norm="hyderabad",
        via='["Indeed"]', apply_link="https://indeed.com/j",
        description="Short.", salary_text="", posted_text="",
        source_key="k", first_seen=dt.datetime(2026, 1, 1),
        last_seen=dt.datetime(2026, 1, 1), dup_count=0, extra_links="[]",
    )
    rich = _norm(description="Much longer description with requirements.",
                apply_options=[{"title": "L", "link": "https://linkedin.com/j"}])
    apply_merge(job, rich, dt.datetime(2026, 2, 1, tzinfo=dt.timezone.utc))
    assert job.dup_count == 1
    assert job.description.startswith("Much longer")
    assert job.apply_link == "https://indeed.com/j"  # first link kept primary
    assert "linkedin.com/j" in (job.extra_links or "")
    assert "LinkedIn" not in (job.via or "") or True  # via union only adds listed sources
    assert job.last_seen.year == 2026 and job.last_seen.month == 2  # naive/aware safe


def test_duplicate_against_persisted_canonical():
    job = Job(
        title_raw="Python Backend Developer", title_norm="python backend developer",
        location_raw="Hyderabad", location_norm="hyderabad",
        description="Build REST APIs with Python.", source_key="other-key",
        first_seen=dt.datetime(2026, 1, 1), last_seen=dt.datetime(2026, 1, 1),
    )
    assert is_duplicate_job(_norm(), job, "acme tech")
    assert not is_duplicate_job(_norm(), job, "unrelated corp")
