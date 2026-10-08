"""Skill vocabulary + extractor tests. Deterministic, no DB."""

from app.data.skills import display_skill, extract_skills, normalize_skill


def test_normalize_aliases_and_noise():
    assert normalize_skill(" PYTHON ") == "python"
    assert normalize_skill("Postgres") == "postgresql"
    assert normalize_skill("Fast API") == "fastapi"
    assert normalize_skill("Amazon Web Services") == "aws"
    assert normalize_skill("k8s") == "kubernetes"
    assert normalize_skill("") == ""
    assert normalize_skill("cobol") == "cobol"  # unknown kept, not guessed


def test_extract_basic_and_order():
    skills = extract_skills("We need Python, Docker and PostgreSQL experience.")
    assert [s for s, _ in skills] == ["python", "docker", "postgresql"]
    assert all(snippet for _, snippet in skills)


def test_no_substring_false_positives():
    norms = [s for s, _ in extract_skills("MySQL required")]
    assert norms == ["mysql"]  # sql must not fire inside mysql
    assert [s for s, _ in extract_skills("GitHub Actions")] == []  # git != github
    assert [s for s, _ in extract_skills("JavaScript and Java")] == ["javascript", "java"]


def test_extract_is_idempotent_and_empty_safe():
    text = "Python and FastAPI. Python again."
    assert extract_skills(text) == extract_skills(text)
    assert [s for s, _ in extract_skills(text)] == ["python", "fastapi"]
    assert extract_skills("") == []
    assert extract_skills("   ") == []


def test_display_names():
    assert display_skill("postgresql") == "PostgreSQL"
    assert display_skill("aws") == "AWS"
    assert display_skill("cobol") == "cobol"
