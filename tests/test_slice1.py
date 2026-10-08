from app.database import Base, engine


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_home_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Find jobs worth applying to" in response.text
    assert "Python Backend Developer" in response.text


def test_database_tables_created(client):
    tables = set(Base.metadata.tables)
    for expected in (
        "searches",
        "jobs",
        "companies",
        "job_skills",
        "evidences",
        "candidates",
        "candidate_skills",
        "matches",
        "skill_gaps",
        "api_usage",
        "cache_entries",
    ):
        assert expected in tables
    assert engine is not None
