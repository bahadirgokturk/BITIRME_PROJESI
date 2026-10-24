"""Uygulama adresi (QR kodlarinin gosterdigi yer): ayarlanmissa o, yoksa ilk CORS adresi."""

from app.core.config import Settings

SECRET = "test-secret-at-least-32-characters-long-000"


def test_public_app_url_wins_and_loses_its_trailing_slash() -> None:
    settings = Settings(
        jwt_secret=SECRET,
        public_app_url="https://kampus.example.com/",
        cors_origins=["http://localhost:3000"],
    )

    assert settings.app_url == "https://kampus.example.com"


def test_first_cors_origin_is_the_default() -> None:
    settings = Settings(
        jwt_secret=SECRET, cors_origins=["https://bitirme-projesi-mu.vercel.app", "http://x"]
    )

    assert settings.app_url == "https://bitirme-projesi-mu.vercel.app"
