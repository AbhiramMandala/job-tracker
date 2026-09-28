"""Shared fixtures: isolated temp SQLite DB per test session."""

import os
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp.name}")

    import app.config as config_module

    config_module.get_settings.cache_clear()

    import app.database as db_module

    db_module.engine = db_module.build_engine(f"sqlite:///{tmp.name}")
    db_module.SessionLocal = db_module.sessionmaker(
        bind=db_module.engine, autoflush=False, autocommit=False, future=True
    )

    from app.main import create_app

    application = create_app()
    with TestClient(application) as test_client:
        yield test_client

    config_module.get_settings.cache_clear()
    try:
        os.unlink(tmp.name)
    except OSError:
        pass
