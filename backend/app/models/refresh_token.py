from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, IdMixin

# sha256 hex uzunlugu
TOKEN_HASH_LENGTH = 64


class RefreshToken(IdMixin, CreatedAtMixin, Base):
    """Refresh token kaydi. Ham token saklanmaz, yalniz sha256 hash'i (app/core/security.py).

    Her yenilemede eski kayit iptal edilir, yenisi eklenir (rotasyon). Iptal edilmis bir token
    tekrar gelirse calinma belirtisi sayilir ve kullanicinin tum kayitlari iptal edilir.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(TOKEN_HASH_LENGTH), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
