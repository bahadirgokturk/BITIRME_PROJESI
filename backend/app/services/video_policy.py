"""Yuklenen videoyu dogrular ve temizler: MP4/MOV (ISO BMFF), en fazla 30 sn.

Yeniden kodlama (ffmpeg) yok; dosya kutu (box) yapisindan okunur:
- Tur: 4-8. baytlarda 'ftyp'. Marka 'qt  ' ise MOV, degilse MP4.
- Sure: moov/mvhd kutusundaki duration / timescale.
- Gizlilik: iPhone konumu moov/meta ve udta (0xA9xyz) kutularinda. Bu kutular AYNI BOYUTTA 'free'
  kutusuna cevrilip icleri sifirlanir; boylece video verisinin ofsetleri (stco) degismez ve dosya
  oynamaya devam eder. Kok duzeydeki 'uuid' (XMP ust verisi) de ayni sekilde silinir.
Sinir: oynatilabilirlik dogrulanmaz; tur icerikten belirlenir ve indirme nosniff ile yapilir.
"""

import hashlib
import struct
from collections.abc import Iterator
from dataclasses import dataclass

from app.core import messages
from app.core.constants import (
    BYTES_PER_MB,
    MAX_VIDEO_SECONDS,
    VIDEO_DURATION_TOLERANCE_SECONDS,
)
from app.core.errors import FileTooLargeError, UnsupportedMediaTypeError, VideoTooLongError

HEADER = 8
LARGE_HEADER = 16
FTYP_OFFSET = 4
QUICKTIME_BRAND = b"qt  "
# Icinde baska kutu barindiran ve konum kutusu tasiyabilen kaplar
_CONTAINERS = frozenset({b"moov", b"trak"})
# Ust veri kutulari: konum, cihaz, yazilim bilgisi
_METADATA = frozenset({b"udta", b"meta", b"uuid"})
_FREE = b"free"


@dataclass(frozen=True)
class Box:
    kind: bytes
    start: int
    header: int
    end: int

    @property
    def payload(self) -> slice:
        return slice(self.start + self.header, self.end)


@dataclass(frozen=True)
class CleanVideo:
    data: bytes
    mime_type: str
    extension: str
    sha256: str
    duration_seconds: float


def is_video(data: bytes) -> bool:
    return data[FTYP_OFFSET : FTYP_OFFSET + 4] == b"ftyp"


def clean_video(data: bytes, *, max_bytes: int) -> CleanVideo:
    if len(data) > max_bytes:
        limit_mb = max_bytes // BYTES_PER_MB or 1
        raise FileTooLargeError(messages.FILE_TOO_LARGE.format(limit_mb=limit_mb))
    if not is_video(data):
        raise UnsupportedMediaTypeError()
    top = list(boxes(data, 0, len(data)))
    duration = _duration(data, top)
    if duration > MAX_VIDEO_SECONDS + VIDEO_DURATION_TOLERANCE_SECONDS:
        raise VideoTooLongError(MAX_VIDEO_SECONDS)
    cleaned = _blank_metadata(data, top)
    quicktime = data[HEADER : HEADER + 4] == QUICKTIME_BRAND
    return CleanVideo(
        data=cleaned,
        mime_type="video/quicktime" if quicktime else "video/mp4",
        extension="mov" if quicktime else "mp4",
        sha256=hashlib.sha256(cleaned).hexdigest(),
        duration_seconds=duration,
    )


def boxes(data: bytes, start: int, end: int) -> Iterator[Box]:
    """[start, end) araligindaki kutulari sirayla verir; tutarsiz boyut dosyayi gecersiz kilar."""
    position = start
    while position < end:
        box = _read_box(data, position, end)
        yield box
        position = box.end


def _read_box(data: bytes, position: int, end: int) -> Box:
    if end - position < HEADER:
        raise UnsupportedMediaTypeError()
    size, kind = struct.unpack_from(">I4s", data, position)
    header = HEADER
    if size == 1:
        if end - position < LARGE_HEADER:
            raise UnsupportedMediaTypeError()
        (size,) = struct.unpack_from(">Q", data, position + HEADER)
        header = LARGE_HEADER
    elif size == 0:
        # 0: kutu dosyanin sonuna kadar surer
        size = end - position
    if size < header or position + size > end:
        raise UnsupportedMediaTypeError()
    return Box(kind=kind, start=position, header=header, end=position + size)


def _duration(data: bytes, top: list[Box]) -> float:
    moov = next((box for box in top if box.kind == b"moov"), None)
    if moov is None:
        raise UnsupportedMediaTypeError()
    mvhd = next((b for b in boxes(data, moov.payload.start, moov.end) if b.kind == b"mvhd"), None)
    if mvhd is None:
        raise UnsupportedMediaTypeError()
    return _mvhd_seconds(data[mvhd.payload])


def _mvhd_seconds(payload: bytes) -> float:
    # version(1) + flags(3), sonra v0: 4+4 zaman, timescale(4), duration(4); v1: 8+8, 4, 8
    layout = ">QQIQ" if payload[:1] == b"\x01" else ">IIII"
    if len(payload) < 4 + struct.calcsize(layout):
        raise UnsupportedMediaTypeError()
    _, _, timescale, duration = struct.unpack_from(layout, payload, 4)
    if timescale == 0:
        raise UnsupportedMediaTypeError()
    return float(duration) / float(timescale)


def _blank_metadata(data: bytes, top: list[Box]) -> bytes:
    output = bytearray(data)
    for box in _metadata_boxes(data, top):
        # Tur alani 'free', icerik sifir; boyut ve konum ayni kalir
        type_offset = box.start + 4
        output[type_offset : type_offset + 4] = _FREE
        output[box.start + box.header : box.end] = bytes(box.end - box.start - box.header)
    return bytes(output)


def _metadata_boxes(data: bytes, level: list[Box]) -> Iterator[Box]:
    for box in level:
        if box.kind in _METADATA:
            yield box
        elif box.kind in _CONTAINERS:
            yield from _metadata_boxes(data, list(boxes(data, box.payload.start, box.end)))
