from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, IdMixin


class Notification(IdMixin, CreatedAtMixin, Base):
    """Kisiye ozel bildirim (zil). Olay kaydi yazilirken services/notifications.py uretir.

    Metin uretim aninda yazilir: bildirim sonradan degisse de kullanicinin gordugu sabit kalir.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        # Zil: kullanicinin okunmamislari ve son bildirimleri
        Index("ix_notifications_user_id_created_at", "user_id", text("created_at DESC")),
        Index(
            "ix_notifications_user_id_unread",
            "user_id",
            postgresql_where=text("read_at IS NULL"),
        ),
    )

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    # Bildirimin basligi (uretim anindaki hali) ve kullaniciya gosterilen cumle
    case_title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(String(300))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
