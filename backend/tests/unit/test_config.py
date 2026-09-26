import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings

DB_URL = "postgresql+psycopg://u:p@localhost:5432/campusflow"


def test_cors_origins_are_parsed_from_comma_separated_string() -> None:
    settings = Settings(
        database_url=DB_URL,
        cors_origins="http://localhost:3000, https://staging.example.com",
    )

    assert settings.cors_origins == ["http://localhost:3000", "https://staging.example.com"]


def test_unknown_environment_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url=DB_URL, environment="prod")


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]


def test_defaults_are_local_development() -> None:
    settings = Settings(database_url=DB_URL)

    assert settings.environment is Environment.LOCAL
    assert settings.log_level == "INFO"
