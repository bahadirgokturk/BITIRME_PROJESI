"""Testler icin kucuk ama yapisi gecerli medya ornekleri (gercek dosya gerekmez)."""

import struct

TIMESCALE = 600
LOCATION = b"+38.4237+027.1428/"


def box(kind: bytes, payload: bytes) -> bytes:
    """ISO BMFF kutusu: 4 bayt boyut + 4 bayt tur + icerik."""
    return struct.pack(">I", 8 + len(payload)) + kind + payload


def _mvhd(seconds: float, version: int = 0) -> bytes:
    duration = int(seconds * TIMESCALE)
    if version == 1:
        times = struct.pack(">QQIQ", 0, 0, TIMESCALE, duration)
    else:
        times = struct.pack(">IIII", 0, 0, TIMESCALE, duration)
    return box(b"mvhd", bytes([version, 0, 0, 0]) + times + bytes(80))


def mp4(seconds: float = 10, brand: bytes = b"isom", version: int = 0) -> bytes:
    ftyp = box(b"ftyp", brand + b"\x00\x00\x02\x00" + brand + b"mp41")
    gps = box(b"\xa9xyz", LOCATION)
    moov = box(
        b"moov",
        _mvhd(seconds, version)
        + box(b"trak", box(b"tkhd", bytes(84)) + box(b"udta", gps))
        + box(b"udta", gps)
        + box(b"meta", bytes(4) + LOCATION),
    )
    return ftyp + moov + box(b"mdat", b"video-data" * 10)
