from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine, make_url

from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
TEST_DB_SUFFIX = "_test"


def _test_database_url() -> URL:
    # Integration testleri gelistirme DB'sine dokunmaz; ayni sunucuda <db>_test kullanilir
    url = make_url(get_settings().database_url)
    return url.set(database=f"{url.database}{TEST_DB_SUFFIX}")


def _create_database_if_missing(url: URL) -> None:
    admin_engine = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin_engine.dispose()


def alembic_config(url: URL) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False))
    return config


@pytest.fixture(scope="session")
def test_db_url() -> URL:
    url = _test_database_url()
    _create_database_if_missing(url)
    command.upgrade(alembic_config(url), "head")
    return url


@pytest.fixture(scope="session")
def test_engine(test_db_url: URL) -> Iterator[Engine]:
    engine = create_engine(test_db_url)
    yield engine
    engine.dispose()
