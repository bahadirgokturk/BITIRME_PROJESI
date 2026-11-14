"""Haftalik rapor verisi: PDF kutuphanesini yuklemeden kurulur (weekly_pdf.py)."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class KpiLine:
    label: str
    value: str
    previous: str
    change: str


@dataclass(frozen=True)
class WeeklyReport:
    organization: str
    period: str
    generated_at: datetime
    summary: str
    kpis: Sequence[KpiLine]
    # Hazir bicimlenmis satirlar (sutun sirasi basliklarla ayni)
    departments: Sequence[Sequence[str]]
    recurring: Sequence[Sequence[str]]
    risks: Sequence[Sequence[str]]
