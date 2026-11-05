"""Video kurallari: MP4/MOV (ISO BMFF), en fazla 30 sn, konum/ust veri kutulari silinir.

Ornek MP4'ler tests/media_samples.py'de uretilir. Oynatici ofsetleri degismemeli: temizlenen
kutular ayni boyutta 'free' olur.
"""

import pytest

from app.core.constants import MAX_VIDEO_SECONDS
from app.core.errors import FileTooLargeError, UnsupportedMediaTypeError, VideoTooLongError
from app.services.video_policy import clean_video
from tests.media_samples import LOCATION, box, mp4

LIMIT = 50 * 1024 * 1024


def test_short_mp4_is_accepted() -> None:
    video = clean_video(mp4(seconds=12), max_bytes=LIMIT)

    assert video.mime_type == "video/mp4"
    assert video.extension == "mp4"


def test_quicktime_brand_is_mov() -> None:
    video = clean_video(mp4(brand=b"qt  "), max_bytes=LIMIT)

    assert (video.mime_type, video.extension) == ("video/quicktime", "mov")


def test_64_bit_movie_header_is_read() -> None:
    with pytest.raises(VideoTooLongError):
        clean_video(mp4(seconds=45, version=1), max_bytes=LIMIT)


def test_video_longer_than_the_limit_is_rejected() -> None:
    with pytest.raises(VideoTooLongError) as error:
        clean_video(mp4(seconds=MAX_VIDEO_SECONDS + 5), max_bytes=LIMIT)

    assert error.value.details == {"max_seconds": MAX_VIDEO_SECONDS}


def test_phone_rounding_at_the_limit_is_tolerated() -> None:
    # Telefon "30 sn" kaydi 30,03 sn gelebilir
    clean_video(mp4(seconds=MAX_VIDEO_SECONDS + 0.4), max_bytes=LIMIT)


def test_location_metadata_is_blanked_without_moving_the_data() -> None:
    original = mp4()

    cleaned = clean_video(original, max_bytes=LIMIT).data

    assert LOCATION not in cleaned
    assert b"udta" not in cleaned
    assert b"meta" not in cleaned
    # Ayni uzunluk ve ayni yerde video verisi: oynaticinin ofsetleri bozulmaz
    assert len(cleaned) == len(original)
    assert cleaned.index(b"mdat") == original.index(b"mdat")


def test_file_without_movie_header_is_rejected() -> None:
    ftyp = box(b"ftyp", b"isom" + bytes(4))

    with pytest.raises(UnsupportedMediaTypeError):
        clean_video(ftyp + box(b"mdat", bytes(16)), max_bytes=LIMIT)


def test_broken_box_size_is_rejected() -> None:
    broken = mp4()[:-5]  # son kutu beyan ettiginden kisa

    with pytest.raises(UnsupportedMediaTypeError):
        clean_video(broken, max_bytes=LIMIT)


def test_video_over_the_size_limit_is_rejected() -> None:
    data = mp4()

    with pytest.raises(FileTooLargeError):
        clean_video(data, max_bytes=len(data) - 1)
