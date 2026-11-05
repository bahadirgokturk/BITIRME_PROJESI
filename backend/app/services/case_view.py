"""Bildirim yanitini (CaseRead) tek yerde uretir: SLA durumu okuma aninda eklenir (E4-2)."""

from datetime import datetime

from app.models import Case
from app.schemas.case import CaseRead
from app.services.sla import case_sla_status


def case_read(case: Case, now: datetime) -> CaseRead:
    read = CaseRead.model_validate(case, from_attributes=True)
    return read.model_copy(update={"sla_status": case_sla_status(case, now)})
