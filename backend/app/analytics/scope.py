"""Analitik donemi ve kapsami: hangi zaman araligi, hangi kurum/birim/bina.

Donem Europe/Istanbul gunleriyle verilir (iki ucu dahil) ve UTC araliga cevrilir. Sorgular
[start, end) yari acik araligi kullanir.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import ColumnElement, Select, and_, or_, select

from app.models import Case, Location
from app.models.enums import CaseStatus

# Kampus saati: gun sinirlari Europe/Istanbul (sabit UTC+3, yaz saati yok)
TURKEY = timezone(timedelta(hours=3))
# Gun/hafta/ay kovalari icin PostgreSQL saat dilimi adi (date_trunc)
TURKEY_TZ_NAME = "Europe/Istanbul"
# Sayim ve sure metriklerinden dusen durumlar (docs/ANALYTICS.md): birlestirilen kayit ayri bir
# sorun degildir; reddedilen kayit cozulmedigi icin sureye girmez
NOT_COUNTED = (CaseStatus.MERGED,)
NO_DURATION = (CaseStatus.MERGED, CaseStatus.REJECTED)
# Acik sayilmayanlar (aging, acik is yuku)
TERMINAL = (CaseStatus.CLOSED, CaseStatus.REJECTED, CaseStatus.MERGED)


@dataclass(frozen=True)
class AnalyticsFilter:
    """API'den gelen ortak filtre (docs/API.md "Analytics")."""

    start: date
    end: date
    department_id: int | None
    building_id: int | None


@dataclass(frozen=True)
class Window:
    start: datetime
    # Haric
    end: datetime

    def previous(self) -> "Window":
        """Hemen onceki esit uzunluktaki donem (KPI karsilastirmasi)."""
        return Window(self.start - (self.end - self.start), self.start)

    def contains(self, column: Any) -> ColumnElement[bool]:
        return and_(column >= self.start, column < self.end)


def days(first: date, last: date) -> Window:
    return Window(_midnight(first), _midnight(last + timedelta(days=1)))


def _midnight(day: date) -> datetime:
    return datetime.combine(day, time.min, TURKEY)


@dataclass(frozen=True)
class Scope:
    """Kurum zorunlu; birim ve bina (lokasyon alt agaci) istege bagli."""

    organization_id: int
    department_id: int | None = None
    building_path: str | None = None

    def apply[S: Select[*tuple[Any, ...]]](self, statement: S) -> S:
        statement = statement.where(Case.organization_id == self.organization_id)
        if self.department_id is not None:
            statement = statement.where(Case.department_id == self.department_id)
        if self.building_path is not None:
            statement = statement.where(Case.location_id.in_(self._subtree()))
        return statement

    def _subtree(self) -> Select[int]:
        return select(Location.id).where(
            Location.organization_id == self.organization_id,
            or_(
                Location.path == self.building_path,
                Location.path.startswith(f"{self.building_path}/", autoescape=True),
            ),
        )
