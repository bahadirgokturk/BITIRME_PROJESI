from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.engine import URL, Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.main import create_app


@pytest.fixture
def app_on_test_db(test_db_url: URL, test_engine: Engine) -> Iterator[FastAPI]:
    app = create_app(
        Settings(
            database_url=test_db_url.render_as_string(hide_password=False),
            jwt_secret=get_settings().jwt_secret,
        )
    )
    factory = sessionmaker(bind=test_engine)

    def _session() -> Iterator[Session]:
        with factory() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    yield app
    app.dependency_overrides.clear()


def test_health_reports_database_ok_against_real_postgres(app_on_test_db: FastAPI) -> None:
    response = TestClient(app_on_test_db).get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
