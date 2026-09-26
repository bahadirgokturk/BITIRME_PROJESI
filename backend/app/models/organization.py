from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, IdMixin


class Organization(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200))
    # Sektor sablonu; bu projede yalniz "campus" kodlanir (docs/ARCHITECTURE.md §4)
    template_code: Mapped[str] = mapped_column(String(30))
    timezone: Mapped[str] = mapped_column(String(50), server_default="Europe/Istanbul")
