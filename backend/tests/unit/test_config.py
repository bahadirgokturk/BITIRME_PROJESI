import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings

DB_URL = "postgresql+psycopg://u:p@localhost:5432/campusflow"
SECRET = "unit-test-secret-that-is-at-least-32-chars"
BASE = {"database_url": DB_URL, "jwt_secret": SECRET}


def test_cors_origins_are_parsed_from_comma_separated_string() -> None:
    settings = Settings(
        **BASE,
        cors_origins="http://localhost:3000, https://staging.example.com",
    )

    assert settings.cors_origins == ["http://localhost:3000", "https://staging.example.com"]


def test_unknown_environment_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(**BASE, environment="prod")


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]


def test_defaults_are_local_development() -> None:
    settings = Settings(**BASE)

    assert settings.environment is Environment.LOCAL
    assert settings.log_level == "INFO"
    assert settings.jwt_access_ttl_min == 30
    assert settings.jwt_refresh_ttl_days == 7


def test_jwt_secret_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValidationError):
        Settings(database_url=DB_URL, _env_file=None)  # type: ignore[call-arg]


def test_short_jwt_secret_is_rejected() -> None:
    # Kisa anahtar kaba kuvvetle tahmin edilebilir; HS256 icin en az 32 karakter
    with pytest.raises(ValidationError):
        Settings(database_url=DB_URL, jwt_secret="kisa")


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_example_secret_is_rejected_outside_local(environment: str) -> None:
    # .env.example'daki ornek anahtar canliya tasinirsa uygulama baslamaz
    from app.core.config import EXAMPLE_JWT_SECRET

    with pytest.raises(ValidationError):
        Settings(database_url=DB_URL, jwt_secret=EXAMPLE_JWT_SECRET, environment=environment)
