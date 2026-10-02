"""Uygulama ayarlari: ortam degiskenlerinden okunur (docs/DEPLOYMENT.md bolum 2)."""

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.constants import MAX_UPLOAD_MB_DEFAULT, MAX_VIDEO_MB_DEFAULT

# HS256 anahtari en az 256 bit olmali (RFC 7518 bolum 3.2): 32 karakter
JWT_SECRET_MIN_LENGTH = 32
# .env.example'daki ornek; yalniz local'de kabul edilir
EXAMPLE_JWT_SECRET = "local-dev-only-secret-change-me-0000000000"  # noqa: S105 - bilinen ornek, reddetmek icin


class Environment(StrEnum):
    LOCAL = "local"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Environment = Environment.LOCAL
    log_level: str = "INFO"
    database_url: str
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    jwt_secret: str = Field(min_length=JWT_SECRET_MIN_LENGTH)
    # Kisa access token calinsa bile zarari sinirlidir; refresh ile yenilenir
    # (docs/DEPLOYMENT.md bolum 2)
    jwt_access_ttl_min: int = 30
    jwt_refresh_ttl_days: int = 7
    # Yuklenen dosyalar: local = disk (gelistirme); s3 staging kurulumunda eklenecek (E7-3a)
    storage_local_path: str = "/app/storage"
    max_upload_mb: int = Field(default=MAX_UPLOAD_MB_DEFAULT, gt=0)
    max_video_mb: int = Field(default=MAX_VIDEO_MB_DEFAULT, gt=0)
    # Agent hatti (E5-8b): kapaliysa bildirim ANALYZING'de kalir, manager elle atar
    # (acil durum anahtari: AGENTS_ENABLED=false)
    agents_enabled: bool = True
    # Monitoring Agent (E5-10): uygulama icinde periyodik izleme; testlerde kapali
    monitoring_enabled: bool = True
    # 5 dk: SLA'lar dakika (en kisa 10 dk kabul) olcegindedir (AGENTS.md 4.8)
    monitoring_interval_seconds: int = Field(default=300, ge=1)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        # Env'de virgulle ayrilmis liste olarak gelir: "http://a, http://b"
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _reject_example_secret_outside_local(self) -> "Settings":
        if self.environment is not Environment.LOCAL and self.jwt_secret == EXAMPLE_JWT_SECRET:
            raise ValueError(
                "JWT_SECRET ornek degerde birakilmis; staging/production icin yeni anahtar uretin"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
