"""Dosya depolama adaptorleri. Servisler yalniz Storage arayuzunu bilir (docs/ARCHITECTURE.md).

local: disk (gelistirme, staging). s3: S3 uyumlu bucket (production; Render diski her yeniden
baslatmada silinir). Hangisinin kullanilacagi STORAGE_BACKEND ayarindan secilir (build_storage).
"""

import re
from pathlib import Path
from typing import Any, Protocol

from app.core.config import Settings, StorageBackend

# Anahtarlar sunucuda uretilir: "<case_id>/<rastgele hex>.<uzanti>"; baska bicim reddedilir
_KEY_PATTERN = re.compile(r"^\d+/[0-9a-f]{32}\.(jpg|png|webp|mp4|mov)$")


class InvalidStorageKeyError(ValueError):
    """Anahtar beklenen bicimde degil (dizin disina cikma girisimi olabilir)."""


class Storage(Protocol):
    def save(self, key: str, data: bytes) -> None: ...

    def read(self, key: str) -> bytes: ...


def _checked(key: str) -> str:
    if not _KEY_PATTERN.fullmatch(key):
        raise InvalidStorageKeyError(key)
    return key


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self._root = root

    def save(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def _path(self, key: str) -> Path:
        return self._root / _checked(key)


class S3Storage:
    """boto3 istemcisiyle; testlerde ayni iki metodu olan sahte istemci verilir."""

    def __init__(self, client: Any, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    def save(self, key: str, data: bytes) -> None:
        self._client.put_object(Bucket=self._bucket, Key=_checked(key), Body=data)

    def read(self, key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=_checked(key))
        except self._client.exceptions.NoSuchKey as error:
            # Yerel depodaki eksik dosya ile ayni davranis
            raise FileNotFoundError(key) from error
        body: bytes = response["Body"].read()
        return body


def _s3_client(settings: Settings) -> Any:
    # Yalniz s3 secilince yuklenir: gelistirme ve testler boto3'e ihtiyac duymaz
    import boto3
    from botocore.config import Config

    secret = settings.s3_secret_access_key
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=secret.get_secret_value() if secret else None,
        # Supabase Storage ve MinIO "bucket.alanadi" adresini tanimaz: alanadi/bucket/anahtar
        config=Config(s3={"addressing_style": "path"}),
    )


def build_storage(settings: Settings) -> Storage:
    if settings.storage_backend is StorageBackend.S3 and settings.s3_bucket:
        return S3Storage(_s3_client(settings), settings.s3_bucket)
    return LocalStorage(Path(settings.storage_local_path))
