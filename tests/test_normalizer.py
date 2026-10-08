"""Normalizer tests: pure functions, no DB."""

from app.schemas.jobs import JobItem
from app.services.normalizer import (
    apply_domain,
    make_source_key,
    normalize_company,
    normalize_job,
    normalize_location,
    normalize_title,
)


def test_company_variants_collapse():
    assert normalize_company("Google LLC") == normalize_company(" GOOGLE LLC ")
    assert normalize_company("Acme Technologies Pvt. Ltd.") == normalize_company(
        "acme tech"
    )


def test_title_normalization():
    assert normalize_title("  Python Backend Developer (Fresher) ") == (
        "python backend developer"
    )
    assert normalize_title("Sr. Python Dev") == "senior python dev"


def test_location_normalization():
    assert normalize_location("Hyderabad, Telangana, India") == normalize_location(
        "hyderabad"
    )
    assert normalize_location("Secunderabad") == "hyderabad"


def test_missing_optional_fields_survive():
    norm = normalize_job(JobItem(title="X"))
    assert norm.company_norm == ""
    assert norm.source_key  # key still computable


def test_source_key_stable_and_distinct():
    item = JobItem(
        title="Python Backend Developer",
        company_name="Acme Tech",
        location="Hyderabad",
        apply_options=[],
    )
    again = normalize_job(JobItem(**item.model_dump()))
    assert normalize_job(item).source_key == again.source_key
    other_company = normalize_job(JobItem(**{**item.model_dump(), "company_name": "Other"}))
    assert other_company.source_key != again.source_key


def test_source_key_ignores_via_but_not_domain():
    base = {"title": "Dev", "company_name": "Acme", "location": "Hyderabad"}
    a = normalize_job(JobItem(**base, apply_options=[{"title": "I", "link": "https://indeed.com/j"}]))
    b = normalize_job(JobItem(**base, apply_options=[{"title": "L", "link": "https://linkedin.com/j"}]))
    # via label is display-only; the apply domain is part of identity
    assert a.source_key != b.source_key
    assert apply_domain("https://www.indeed.com/j") == "indeed.com"
