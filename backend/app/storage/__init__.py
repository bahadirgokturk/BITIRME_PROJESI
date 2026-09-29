"""Dosya depolama adaptorleri. Servisler yalniz Storage arayuzunu bilir (docs/ARCHITECTURE.md).

local: gelistirmede disk. s3: staging/production (E7-3a), ayni arayuzle eklenecek.
"""

import re
from pathlib import Path
from typing import Protocol

# Anahtarlar sunucuda uretilir: "<case_id>/<rastgele hex>.<uzanti>"; baska bicim reddedilir
_KEY_PATTERN = re.compile(r"^\d+/[0-9a-f]{32}\.(jpg|png|webp|mp4|mov)$")


class InvalidStorageKeyError(ValueError):
    """Anahtar beklenen bicimde degil (dizin disina cikma girisimi olabilir)."""


class Storage(Protocol):
    def save(self, key: str, data: bytes) -> None: ...

    def read(self, key: str) -> bytes: ...


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
        if not _KEY_PATTERN.fullmatch(key):
            raise InvalidStorageKeyError(key)
        return self._root / key
