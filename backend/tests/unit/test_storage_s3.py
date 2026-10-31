"""S3 uyumlu depo (production E7-3): Render diski kalici degil, fotograflar bucket'ta tutulur.

Gercek servis yerine sahte istemci: yalniz put_object/get_object cagrilari ve hata eslemesi denenir.
"""

from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.storage import InvalidStorageKeyError, LocalStorage, S3Storage, build_storage

KEY = "42/" + "a" * 32 + ".jpg"
BASE = {"database_url": "postgresql://u:p@db/x", "jwt_secret": "x" * 40}
S3_SETTINGS = {
    "storage_backend": "s3",
    "s3_bucket": "campusflow-prod",
    "s3_endpoint_url": "https://abc.supabase.co/storage/v1/s3",
    "s3_access_key_id": "anahtar",
    "s3_secret_access_key": "gizli",
}


class NoSuchKeyError(Exception):
    pass


class FakeS3:
    exceptions = SimpleNamespace(NoSuchKey=NoSuchKeyError)

    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:  # noqa: N803 - boto3 adlari
        self.objects[(Bucket, Key)] = Body

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:  # noqa: N803 - boto3 adlari
        if (Bucket, Key) not in self.objects:
            raise NoSuchKeyError(Key)
        body = self.objects[(Bucket, Key)]
        return {"Body": SimpleNamespace(read=lambda: body)}


def test_saved_file_is_read_back_from_the_bucket() -> None:
    client = FakeS3()
    storage = S3Storage(client, "kova")

    storage.save(KEY, b"foto")

    assert client.objects == {("kova", KEY): b"foto"}
    assert storage.read(KEY) == b"foto"


def test_missing_object_behaves_like_a_missing_local_file() -> None:
    with pytest.raises(FileNotFoundError):
        S3Storage(FakeS3(), "kova").read(KEY)


@pytest.mark.parametrize("key", ["../etc/passwd", "42/x.jpg", "42/" + "a" * 32 + ".exe"])
def test_invalid_key_never_reaches_the_bucket(key: str) -> None:
    client = FakeS3()

    with pytest.raises(InvalidStorageKeyError):
        S3Storage(client, "kova").save(key, b"x")
    assert client.objects == {}


def test_local_is_the_default_backend(tmp_path: Path) -> None:
    settings = Settings(**BASE, storage_local_path=str(tmp_path))

    assert isinstance(build_storage(settings), LocalStorage)


def test_s3_backend_builds_a_bucket_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    def fake_client(settings: Settings) -> FakeS3:
        seen["endpoint"] = settings.s3_endpoint_url
        return FakeS3()

    monkeypatch.setattr("app.storage._s3_client", fake_client)

    storage = build_storage(Settings(**BASE, **S3_SETTINGS))

    assert isinstance(storage, S3Storage)
    assert seen["endpoint"] == S3_SETTINGS["s3_endpoint_url"]


@pytest.mark.parametrize("missing", ["s3_bucket", "s3_access_key_id", "s3_secret_access_key"])
def test_s3_backend_requires_bucket_and_keys(missing: str) -> None:
    incomplete = {k: v for k, v in S3_SETTINGS.items() if k != missing}

    with pytest.raises(ValidationError, match=missing.upper()):
        Settings(**BASE, **incomplete)


def test_secret_key_is_not_shown_in_settings_repr() -> None:
    assert "gizli" not in repr(Settings(**BASE, **S3_SETTINGS))
