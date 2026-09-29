"""Yuklenen fotografi dogrular ve temizler (docs/ARCHITECTURE.md bolum 9).

1. Boyut siniri.  2. Tur icerikten (magic bytes) belirlenir; dosya adi ve istemcinin bildirdigi
Content-Type'a guvenilmez.  3. Pillow ile gercekten acilir (bozuk/sahte dosya elenir),
sikistirma bombasi reddedilir.  4. Telefon donusu uygulanip yeniden kodlanir: EXIF (GPS konumu,
cihaz bilgisi) atilir, dosyaya gizlenmis ek veri tasinmaz.
"""

import hashlib
import warnings
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core import messages
from app.core.constants import BYTES_PER_MB
from app.core.errors import FileTooLargeError, UnsupportedMediaTypeError


@dataclass(frozen=True)
class ImageType:
    mime_type: str
    pillow_format: str
    extension: str


JPEG = ImageType("image/jpeg", "JPEG", "jpg")
PNG = ImageType("image/png", "PNG", "png")
WEBP = ImageType("image/webp", "WEBP", "webp")

# Dosya imzalari (magic bytes); WEBP: "RIFF" + 4 bayt boyut + "WEBP"
_SIGNATURES: tuple[tuple[bytes, int, ImageType], ...] = (
    (b"\xff\xd8\xff", 0, JPEG),
    (b"\x89PNG\r\n\x1a\n", 0, PNG),
    (b"WEBP", 8, WEBP),
)
_RIFF = b"RIFF"
# Pillow'un kabul ettigi okuma hatalari: bozuk/kesik dosya, tanimsiz bicim, sikistirma bombasi
_DECODE_ERRORS = (
    UnidentifiedImageError,
    OSError,
    SyntaxError,
    Image.DecompressionBombError,
    Image.DecompressionBombWarning,
)


@dataclass(frozen=True)
class CleanImage:
    data: bytes
    mime_type: str
    extension: str
    sha256: str


def clean_image(data: bytes, *, max_bytes: int) -> CleanImage:
    if len(data) > max_bytes:
        limit_mb = max_bytes // BYTES_PER_MB or 1
        raise FileTooLargeError(messages.FILE_TOO_LARGE.format(limit_mb=limit_mb))
    image_type = sniff(data)
    cleaned = _reencode(data, image_type)
    return CleanImage(
        data=cleaned,
        mime_type=image_type.mime_type,
        extension=image_type.extension,
        sha256=hashlib.sha256(cleaned).hexdigest(),
    )


def sniff(data: bytes) -> ImageType:
    for signature, offset, image_type in _SIGNATURES:
        if data[offset : offset + len(signature)] != signature:
            continue
        if image_type is WEBP and not data.startswith(_RIFF):
            continue
        return image_type
    raise UnsupportedMediaTypeError()


def _reencode(data: bytes, image_type: ImageType) -> bytes:
    try:
        with warnings.catch_warnings():
            # Pillow sinirin 1-2 kati piksele yalniz uyari verir; onu da hata say
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if source.format != image_type.pillow_format:
                    raise UnsupportedMediaTypeError()
                upright = ImageOps.exif_transpose(source)
                output = BytesIO()
                # exif verilmez: kaydedilen dosyada EXIF olmaz
                upright.save(output, format=image_type.pillow_format)
    except _DECODE_ERRORS as error:
        raise UnsupportedMediaTypeError() from error
    return output.getvalue()
