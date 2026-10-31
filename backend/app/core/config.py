"""Uygulama ayarlari: ortam degiskenlerinden okunur (docs/DEPLOYMENT.md bolum 2)."""

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.constants import MAX_UPLOAD_MB_DEFAULT, MAX_VIDEO_MB_DEFAULT

# HS256 anahtari en az 256 bit olmali (RFC 7518 bolum 3.2): 32 karakter
JWT_SECRET_MIN_LENGTH = 32
# Dis tetikleyici anahtari (/internal/monitoring/run): tahmin edilemesin, JWT ile ayni alt sinir
INTERNAL_TOKEN_MIN_LENGTH = 32
PSYCOPG_URL_PREFIX = "postgresql+psycopg://"
HOSTED_URL_PREFIXES = ("postgresql://", "postgres://")
# .env.example'daki ornek; yalniz local'de kabul edilir
EXAMPLE_JWT_SECRET = "local-dev-only-secret-change-me-0000000000"  # noqa: S105 - bilinen ornek, reddetmek icin


class Environment(StrEnum):
    LOCAL = "local"
    STAGING = "staging"
    PRODUCTION = "production"


class StorageBackend(StrEnum):
    # local: disk (gelistirme, staging); s3: S3 uyumlu bucket (production, Render diski gecici)
    LOCAL = "local"
    S3 = "s3"


class LlmProvider(StrEnum):
    # none: sistem LLM'siz tam calisir (varsayilan, docs/AGENTS.md); ollama: yerel model
    NONE = "none"
    OLLAMA = "ollama"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Environment = Environment.LOCAL
    log_level: str = "INFO"
    database_url: str
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    # Kullanicinin actigi uygulama adresi (QR kodlari buraya gider); bossa ilk CORS adresi
    public_app_url: str | None = None
    jwt_secret: str = Field(min_length=JWT_SECRET_MIN_LENGTH)
    # Kisa access token calinsa bile zarari sinirlidir; refresh ile yenilenir
    # (docs/DEPLOYMENT.md bolum 2)
    jwt_access_ttl_min: int = 30
    jwt_refresh_ttl_days: int = 7
    # Yuklenen dosyalar: local = disk; s3 = Supabase Storage, R2, MinIO gibi S3 uyumlu depo
    storage_backend: StorageBackend = StorageBackend.LOCAL
    storage_local_path: str = "/app/storage"
    s3_bucket: str | None = None
    # Bos: AWS'nin kendisi; diger saglayicilar kendi adresini verir
    s3_endpoint_url: str | None = None
    s3_region: str = "auto"
    s3_access_key_id: str | None = None
    s3_secret_access_key: SecretStr | None = None
    max_upload_mb: int = Field(default=MAX_UPLOAD_MB_DEFAULT, gt=0)
    max_video_mb: int = Field(default=MAX_VIDEO_MB_DEFAULT, gt=0)
    # Opsiyonel yerel LLM: yalniz yonetim ozetini akicilastirir (E5-12); ucretli API yok
    llm_provider: LlmProvider = LlmProvider.NONE
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    # Agent hatti (E5-8b): kapaliysa bildirim ANALYZING'de kalir, manager elle atar
    # (acil durum anahtari: AGENTS_ENABLED=false)
    agents_enabled: bool = True
    # Monitoring Agent (E5-10): uygulama icinde periyodik izleme; testlerde kapali
    monitoring_enabled: bool = True
    # 5 dk: SLA'lar dakika (en kisa 10 dk kabul) olcegindedir (AGENTS.md 4.8)
    monitoring_interval_seconds: int = Field(default=300, ge=1)
    # Ucretsiz sunucu uyurken dongu durur; GitHub Actions bu anahtarla turu disaridan tetikler.
    # Bossa uc gorunmez (404)
    internal_token: SecretStr | None = Field(default=None, min_length=INTERNAL_TOKEN_MIN_LENGTH)

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        # Neon/Render adresi surucusuz gelir ("postgresql://", eski "postgres://"); SQLAlchemy
        # surucu belirtilmezse psycopg2 arar, projede psycopg 3 kurulu (pyproject.toml)
        for prefix in HOSTED_URL_PREFIXES:
            if value.startswith(prefix):
                return PSYCOPG_URL_PREFIX + value.removeprefix(prefix)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        # Env'de virgulle ayrilmis liste olarak gelir: "http://a, http://b"
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def app_url(self) -> str:
        """Sonunda / olmadan; staging'de CORS_ORIGINS zaten Vercel adresidir."""
        return (self.public_app_url or self.cors_origins[0]).rstrip("/")

    @model_validator(mode="after")
    def _require_s3_credentials(self) -> "Settings":
        if self.storage_backend is not StorageBackend.S3:
            return self
        missing = [
            name.upper()
            for name in ("s3_bucket", "s3_access_key_id", "s3_secret_access_key")
            if not getattr(self, name)
        ]
        if missing:
            raise ValueError(f"STORAGE_BACKEND=s3 icin eksik: {', '.join(missing)}")
        return self

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
