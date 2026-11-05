"""Yuklenen fotograf kurallari (docs/ARCHITECTURE.md bolum 9): icerikten tur tespiti, beyaz liste,
boyut siniri, EXIF temizleme, sikistirma bombasi."""

from io import BytesIO

import pytest
from PIL import Image

from app.core.errors import FileTooLargeError, UnsupportedMediaTypeError
from app.services.image_policy import clean_image

LIMIT = 5 * 1024 * 1024
# EXIF GPS etiketi (0x8825); konum bilgisi kullanici gizliligi icin silinmeli
GPS_TAG = 0x8825
ORIENTATION_TAG = 0x0112
ROTATED_90 = 6


def _image(fmt: str, size: tuple[int, int] = (8, 4), exif: Image.Exif | None = None) -> bytes:
    buffer = BytesIO()
    options = {"exif": exif} if exif is not None else {}
    Image.new("RGB", size, "red").save(buffer, format=fmt, **options)
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("fmt", "mime"), [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")]
)
def test_allowed_images_are_accepted(fmt: str, mime: str) -> None:
    cleaned = clean_image(_image(fmt), max_bytes=LIMIT)

    assert cleaned.mime_type == mime
    assert Image.open(BytesIO(cleaned.data)).format == fmt


def test_type_comes_from_content_not_from_the_name() -> None:
    # .jpg adli bir HTML/metin dosyasi reddedilir
    with pytest.raises(UnsupportedMediaTypeError):
        clean_image(b"<html><script>alert(1)</script></html>", max_bytes=LIMIT)


def test_gif_is_not_on_the_whitelist() -> None:
    with pytest.raises(UnsupportedMediaTypeError):
        clean_image(_image("GIF"), max_bytes=LIMIT)


def test_truncated_image_with_valid_header_is_rejected() -> None:
    with pytest.raises(UnsupportedMediaTypeError):
        clean_image(_image("PNG")[:40], max_bytes=LIMIT)


def test_file_over_the_limit_is_rejected() -> None:
    data = _image("PNG")

    with pytest.raises(FileTooLargeError):
        clean_image(data, max_bytes=len(data) - 1)


def test_exif_location_is_removed() -> None:
    exif = Image.Exif()
    exif[GPS_TAG] = {1: "N", 2: (38.0, 27.0, 0.0)}

    cleaned = clean_image(_image("JPEG", exif=exif), max_bytes=LIMIT)

    assert GPS_TAG not in Image.open(BytesIO(cleaned.data)).getexif()


def test_phone_rotation_is_applied_before_exif_is_dropped() -> None:
    # Telefon fotografi yan kaydedilip EXIF ile dondurulur; EXIF silinince goruntu yan kalmasin
    exif = Image.Exif()
    exif[ORIENTATION_TAG] = ROTATED_90

    cleaned = clean_image(_image("JPEG", size=(8, 4), exif=exif), max_bytes=LIMIT)

    assert Image.open(BytesIO(cleaned.data)).size == (4, 8)


def test_decompression_bomb_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    # Kucuk dosya, devasa piksel sayisi: acilinca bellegi doldurur. 100x100 = 10.000 piksel,
    # sinirin 1-2 kati: Pillow burada yalniz UYARI verir; kural uyariyi da hata sayar
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 6000)

    with pytest.raises(UnsupportedMediaTypeError):
        clean_image(_image("PNG", size=(100, 100)), max_bytes=LIMIT)


def test_hash_is_of_the_cleaned_file() -> None:
    import hashlib

    cleaned = clean_image(_image("PNG"), max_bytes=LIMIT)

    assert cleaned.sha256 == hashlib.sha256(cleaned.data).hexdigest()
