from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect
from sqlalchemy.engine import URL, Engine

from app.models import Base
from tests.integration.conftest import alembic_config

FAZ1_TABLES = {"organizations", "departments", "locations", "users"}


def test_upgrade_creates_faz1_tables(test_engine: Engine) -> None:
    tables = set(inspect(test_engine).get_table_names())

    assert tables >= FAZ1_TABLES


def test_downgrade_base_then_upgrade_head_roundtrip(test_db_url: URL, test_engine: Engine) -> None:
    config = alembic_config(test_db_url)

    command.downgrade(config, "base")
    assert set(inspect(test_engine).get_table_names()) == {"alembic_version"}

    command.upgrade(config, "head")
    assert set(inspect(test_engine).get_table_names()) >= FAZ1_TABLES


def test_models_match_migrations(test_engine: Engine) -> None:
    # Model degisip migration yazilmadiysa bu test kirmizi olur
    with test_engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)

    assert diff == []
