from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.orm import Session

from app.core.clock import get_clock
from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.main import create_app

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


@pytest.fixture
def db_session(test_engine: Engine) -> Iterator[Session]:
    # Her test kendi transaction'inda calisir ve sonunda geri alinir; servislerin commit'i
    # savepoint'e donusur, veri testler arasinda sizmaz (docs/TESTING.md "Kurallar")
    connection = test_engine.connect()
    transaction = connection.begin()
    # expire_on_commit=False: uygulamanin oturumuyla ayni (app/core/database.py); aksi halde testte
    # commit sonrasi nesneler tazelenir, uygulamadaki bayat iliski hatalari gizli kalir
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    yield session
    session.close()
    transaction.rollback()
    connection.close()


class FrozenClock:
    def __init__(self, now: datetime) -> None:
        self.current = now

    def now(self) -> datetime:
        return self.current

    def advance(self, delta: timedelta) -> None:
        self.current += delta


@pytest.fixture
def clock() -> FrozenClock:
    return FrozenClock(datetime(2026, 9, 26, 12, 0, tzinfo=UTC))


@pytest.fixture
def client(
    db_session: Session, clock: FrozenClock, test_db_url: URL, tmp_path: Path
) -> Iterator[TestClient]:
    settings = Settings(
        database_url=test_db_url.render_as_string(hide_password=False),
        jwt_secret=get_settings().jwt_secret,
        # Yuklenen dosyalar gelistirme klasorune degil, teste ozel gecici klasore yazilir
        storage_local_path=str(tmp_path),
    )
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_clock] = lambda: clock
    # Cookie'ler "Secure" olmadan da gonderilsin diye https taban adresi
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
