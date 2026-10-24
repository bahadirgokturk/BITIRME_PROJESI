"""Konum QR kodu (kapiya asilir): okutulunca bildirim formu o konum secili acilir.

QR yalniz bir adres tasir; kim okutursa okutsun once giris yapar, konum ve yetki sunucuda yeniden
kontrol edilir (GET /locations/{id}). QR'da gizli bilgi yoktur.
"""

import io
from dataclasses import dataclass

import segno

from app.models import Location
from app.schemas.location import QrFormat

# Hata duzeltme "m": kirli ya da biraz yirtik etikette de okunur, kod buyumez
QR_ERROR_LEVEL = "m"
# Modul basina piksel ve kenar bosluk (modul): A6 etikette telefonla rahat okunur
QR_SCALE = 10
QR_BORDER = 2
MEDIA_TYPES = {QrFormat.SVG: "image/svg+xml", QrFormat.PNG: "image/png"}


@dataclass(frozen=True)
class QrImage:
    content: bytes
    media_type: str
    filename: str


def report_url(app_url: str, location_id: int) -> str:
    return f"{app_url.rstrip('/')}/report?location={location_id}"


def render(location: Location, app_url: str, fmt: QrFormat) -> QrImage:
    buffer = io.BytesIO()
    code = segno.make(report_url(app_url, location.id), error=QR_ERROR_LEVEL)
    code.save(buffer, kind=fmt.value, scale=QR_SCALE, border=QR_BORDER)
    return QrImage(
        content=buffer.getvalue(),
        media_type=MEDIA_TYPES[fmt],
        filename=f"qr-{location.code}.{fmt.value}",
    )
