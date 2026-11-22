"""Veri saklama (docs/DEPLOYMENT.md "Veri saklama"): izleme turunda calisan temizlik.

Ucretsiz veritabani kotasi (Neon 0,5 GB) yillarca dolmasin diye yalniz artik ise yaramayan satirlar
silinir; bildirim kayitlari (cases), olaylar ve denetim izi hic silinmez.
- Refresh token: suresi dolmus token zaten kullanilamaz. Bir hafta daha tutulur: yeni dolmus bir
  token tekrar gelirse calinma tespiti (family iptali) kaydi bulabilsin.
- Kisiye ozel bildirim: okunmus ve 90 gunden eski olanlar. Okunmamislar silinmez.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast

from sqlalchemy import Delete, delete
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.models import Notification, RefreshToken

TOKEN_KEEP_AFTER_EXPIRY = timedelta(days=7)
NOTIFICATION_KEEP = timedelta(days=90)


@dataclass(frozen=True)
class Purged:
    tokens: int
    notifications: int


def purge(session: Session, now: datetime) -> Purged:
    # Rotasyon zincirinde eski kayit yenisini gosterir; yeni kayit daha gec dolar, bu yuzden
    # silinen her kaydi gosteren eski kayit da ayni komutta silinir (FK komut sonunda denetlenir)
    tokens = _deleted(
        session,
        delete(RefreshToken).where(RefreshToken.expires_at < now - TOKEN_KEEP_AFTER_EXPIRY),
    )
    notifications = _deleted(
        session, delete(Notification).where(Notification.read_at < now - NOTIFICATION_KEEP)
    )
    return Purged(tokens=tokens, notifications=notifications)


def _deleted(session: Session, statement: Delete) -> int:
    # DELETE sonucu CursorResult'tir; rowcount yalniz orada tanimli
    result = cast(CursorResult[Any], session.execute(statement))
    return result.rowcount
