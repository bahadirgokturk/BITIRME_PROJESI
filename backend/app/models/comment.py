from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, Text, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, IdMixin
from app.models.user import User


class Comment(IdMixin, CreatedAtMixin, Base):
    """Bildirim yorumu. is_internal: personel/mudur notu; bildirim yapan gormez (WORKFLOW.md)."""

    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_case_id_created_at", "case_id", "created_at"),)

    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"))
    author_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    is_internal: Mapped[bool] = mapped_column(Boolean, server_default=false())

    # Yanitta yazar adi ve rolu gosterilir; liste sorgusu selectinload ile tek seferde getirir
    author: Mapped[User] = relationship(lazy="raise")
