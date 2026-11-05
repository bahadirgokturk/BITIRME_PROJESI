from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, IdMixin
from app.models.case import Case
from app.models.department import Department
from app.models.enums import TaskStatus


class Task(IdMixin, CreatedAtMixin, Base):
    """Bildirimi cozmek icin bir departmana (ve istege bagli bir kisiye) verilen is.

    MVP kurali (docs/DATABASE.md): bir bildirimin ayni anda en fazla 1 aktif gorevi olur;
    kismi tekil index bunu veritabaninda da garanti eder.
    Durum yalniz WorkflowService tablosuyla degisir.
    """

    __tablename__ = "tasks"
    __table_args__ = (
        Index(
            "uq_tasks_one_active_per_case",
            "case_id",
            unique=True,
            postgresql_where=text("status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')"),
        ),
        Index("ix_tasks_assigned_user_id_status", "assigned_user_id", "status"),
        Index("ix_tasks_department_id_status", "department_id", "status"),
    )

    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"))
    department_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("departments.id"))
    # Bos: departman kuyrugunda, ilk kabul eden personel ustlenir
    assigned_user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus, name="task_status"))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completion_note: Mapped[str | None] = mapped_column(Text)
    declined_reason: Mapped[str | None] = mapped_column(Text)

    # Yanitta bildirim ozeti ve departman gosterilir; sorgular selectinload ile getirir
    case: Mapped[Case] = relationship(lazy="raise")
    department: Mapped[Department] = relationship(lazy="raise")
