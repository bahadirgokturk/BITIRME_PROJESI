import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, IdMixin

# sha256 hex uzunlugu
TOKEN_HASH_LENGTH = 64


class RefreshToken(IdMixin, CreatedAtMixin, Base):
    """Refresh token kaydi. Ham token saklanmaz, yalniz sha256 hash'i (app/core/security.py).

    Her yenilemede eski kayit iptal edilir, yenisi eklenir (rotasyon). Bir giristen dogan zincir
    ayni family_id'yi tasir (bir cihazdaki oturum). Iptal edilmis bir token tekrar gelirse calinma
    belirtisi sayilir ve o zincir kapatilir; kullanicinin diger cihazlari etkilenmez.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(TOKEN_HASH_LENGTH), unique=True)
    # Ayni giristen rotasyonla dogan butun kayitlar (bir oturum); giriste yeni deger uretilir
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Rotasyonla iptal edildiyse yerine gelen kayit; cikis/toplu iptalde NULL kalir
    replaced_by_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("refresh_tokens.id"))
