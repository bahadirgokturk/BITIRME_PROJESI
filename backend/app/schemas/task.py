"""Gorev (task) sozlesmesi, FAZ 4 (docs/API.md "Tasks", docs/DATABASE.md "tasks")."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import TASK_NOTE_MAX_LENGTH
from app.models.enums import Priority, SlaStatus, TaskStatus
from app.schemas.case import DepartmentSummary, LocationSummary


class TaskRead(BaseModel):
    """Personel ekrani icin gorev + bildirim ozeti; liste SLA'ya kalan sureye gore siralanir."""

    id: int
    case_id: int
    case_number: str
    title: str
    # Bildirimin aciklamasi: personel isi anlamak icin okur
    description: str
    status: TaskStatus
    department: DepartmentSummary
    assigned_user_id: int | None
    location: LocationSummary
    priority: Priority | None
    created_at: datetime
    accepted_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    completion_note: str | None
    declined_reason: str | None
    # SLA cozum hedefi ve durumu (E4-2); kural yoksa ikisi de bos
    due_at: datetime | None
    sla_status: SlaStatus | None


class DeclineRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=TASK_NOTE_MAX_LENGTH)


class CompleteRequest(BaseModel):
    completion_note: str | None = Field(default=None, max_length=TASK_NOTE_MAX_LENGTH)


class AssignRequest(BaseModel):
    """Manager atamasi: departman zorunlu; kisi secilmezse departmanin kuyruguna duser."""

    department_id: int
    user_id: int | None = None
