import pytest
from fastapi import FastAPI

from app.core.config import Settings
from app.main import create_app

UNIT_DB_URL = "postgresql+psycopg://unit:unit@localhost:5432/unit_tests_do_not_connect"


@pytest.fixture
def test_app() -> FastAPI:
    # Unit testleri DB'ye baglanmaz; URL yalnizca ayar dogrulamasi icin verilir
    return create_app(Settings(database_url=UNIT_DB_URL))
