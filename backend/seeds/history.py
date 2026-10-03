"""Demo gecmisi (E6-1): son N gunun bildirimleri gercek sistemden gecirilerek uretilir.

Veri elle uydurulmaz: bir simulasyon saati gecmiste ilerler; bildirimler gercek agent hattindan
gecer, personel gercek gorev servisiyle kabul edip tamamlar, Resolution ve Monitoring calisir.
Boylece olay kaydi, agent kararlari ve sureler uygulamayla tutarlidir (tezdeki olcumler gercek
davranistir).
Senaryo ve gomulu oruntuler (RQ4'un dogru cevabi): seeds/demo/history.yaml.

Belirlenimci: ayni plan ve ayni bitis zamani ayni veriyi uretir (sabit rastgele tohum).
"""

import heapq
import itertools
import random
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Case, Organization, Task, User
from app.models.enums import CaseStatus, OverrideField, ReporterKind, UserRole
from app.repositories import (
    case_repository,
    case_type_repository,
    department_repository,
    location_repository,
    task_repository,
    user_repository,
)
from app.schemas.case import (
    CaseCreate,
    CloseRequest,
    FeedbackCreate,
    InfoReplyCreate,
    OverrideRequest,
    RejectRequest,
    ReopenRequest,
)
from app.schemas.task import AssignRequest, CompleteRequest
from app.services.analysis_service import AnalysisService
from app.services.case_interaction_service import CaseInteractionService
from app.services.case_service import CaseService
from app.services.monitoring_service import MonitoringService
from app.services.review_service import ReviewService
from app.services.task_service import TaskService
from app.services.workflow import ACTIVE_TASK_STATUSES
from seeds.schema import load

HISTORY_FILE = Path(__file__).parent / "demo" / "history.yaml"
# Kampus saati (sabit UTC+3): mesai ve ders saatleri buna gore
TURKEY = timezone(timedelta(hours=3))
WORKDAY_START_HOUR = 8
# Kampus hizmetleri (temizlik, yemekhane, teknik) 08-20, cumartesi dahil; pazar kapali
WORKDAY_END_HOUR = 20
REPORT_START_HOUR = 8
REPORT_END_HOUR = 20
SATURDAY = 5
SUNDAY = 6
MINUTES_PER_HOUR = 60
# Oruntu bildirimleri belirtilen saatten sonraki bu kadar dakikaya dagilir
PATTERN_SPREAD = 50
# Hafta sonu kampus sakin: bildirim orani bu kadarla carpilir
WEEKEND_FACTOR = 0.3
# Oruntu sayilari 30 gune goredir (tekrarlayan sorun penceresi, docs/ANALYTICS.md)
PATTERN_WINDOW_DAYS = 30
BURST_REFERENCE_DAYS = 60
# Dashboard'da acik is olsun diye son dakikalarda gelen bildirimler (tam planda ~35-40 acik kalir)
RECENT_REPORTS = 60
# Son 90 dakika: personelin henuz bitiremedigi isler
RECENT_MINUTES = 90
# Izleme turu (Monitoring Agent) simulasyonda saatte bir
MONITOR_EVERY = timedelta(hours=1)
# Olasiliklar (varsayim; demo cesitliligi icin)
NOT_DONE_PROBABILITY = 0.04
INFO_REPLY_PROBABILITY = 0.75
FEEDBACK_PROBABILITY = 0.65
REOPEN_PROBABILITY = 0.03
# Gecikmeler (dakika): (en az, en cok)
START_DELAY = (2, 15)
MANAGER_DELAY = (15, 90)
INFO_REPLY_DELAY = (10, 180)
FEEDBACK_DELAY = (30, 48 * 60)
REOPEN_DELAY = (60, 24 * 60)
OFF_HOURS_SPREAD = (0, 40)
# Puan: zamaninda cozulen ise yuksek, gec kalana dusuk
ON_TIME_RATINGS = (4, 5, 5)
LATE_RATINGS = (2, 3, 3, 4)
SPOT_BURST_TYPES = ("SOAP_EMPTY", "TOILET_PAPER_EMPTY", "TRASH_FULL", "WIFI_FAILURE")
MEANINGLESS = "MEANINGLESS"
MANAGER_FOR_MAINTENANCE = "mudur.bakim@kampus.example.com"
DEFAULT_MANAGER = "mudur.destek@kampus.example.com"
EXTRA_REPORTER_EMAIL = "ogrenci{index:02d}@kampus.example.com"
REOPEN_REASON = "Sorun tekrar etti."
REVIEW_REASON = "Müdür incelemesi: tür düzeltildi."


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PatternSeed(_Strict):
    location: str
    case_type: str
    count: int
    hour: int
    note: str


class BurstSeed(_Strict):
    count: int
    reporters: tuple[int, int]
    within_minutes: int


class DepartmentProfile(_Strict):
    accept: tuple[int, int]


class NotesSeed(_Strict):
    done: list[str]
    not_done: list[str]


class StaffSeed(_Strict):
    email: str
    full_name: str
    department: str


class ExtraUsersSeed(_Strict):
    reporters: int
    staff: list[StaffSeed]


class HistoryFile(_Strict):
    phrases: dict[str, list[str]]
    locations: dict[str, list[str]]
    weights: dict[str, int]
    patterns: list[PatternSeed]
    bursts: BurstSeed
    departments: dict[str, DepartmentProfile]
    work_minutes: dict[str, tuple[int, int]]
    completion_notes: NotesSeed
    extra_users: ExtraUsersSeed


@dataclass(frozen=True)
class HistoryPlan:
    # Gecmisin bittigi an (genelde simdi); bildirimler [end - days, end) araliginda
    end: datetime
    days: int = 60
    base_reports_per_day: float = 8.0
    seed: int = 2026


@dataclass(frozen=True)
class HistoryResult:
    created: int
    open: int


@dataclass(frozen=True)
class Report:
    at: datetime
    case_type: str
    location: str
    text: str
    reporter: int


class SimClock:
    """Gecmiste ilerleyen saat; servisler zamani buradan okur."""

    def __init__(self, now: datetime) -> None:
        self.current = now

    def now(self) -> datetime:
        return self.current


@dataclass
class _Queue:
    items: list[tuple[datetime, int, Callable[[], None]]] = field(default_factory=list)
    counter: itertools.count = field(default_factory=itertools.count)  # type: ignore[type-arg]

    def push(self, at: datetime, action: Callable[[], None]) -> None:
        heapq.heappush(self.items, (at, next(self.counter), action))


_TERMINAL = frozenset({CaseStatus.CLOSED, CaseStatus.REJECTED, CaseStatus.MERGED})


def seed_history(
    session: Session, organization: Organization, password: str, plan: HistoryPlan
) -> HistoryResult:
    """Gecmisi bir kez uretir; tohumlanmis bildirim varsa dokunmaz (idempotent)."""
    seeded = session.scalar(
        select(func.count()).where(Case.organization_id == organization.id, Case.is_seed.is_(True))
    )
    if seeded:
        return HistoryResult(created=0, open=0)
    data = load(HISTORY_FILE, HistoryFile)
    _ensure_extra_users(session, organization, data.extra_users, password)
    start = plan.end - timedelta(days=plan.days)
    simulation = _Simulation(session, organization, data, SimClock(start))
    simulation.run(_plan_reports(data, plan, simulation.reporter_count), plan.end)
    return simulation.result()


# --- Bildirim plani --------------------------------------------------------------------------


def _plan_reports(data: HistoryFile, plan: HistoryPlan, reporters: int) -> list[Report]:
    planner = _Planner(data, plan, reporters)
    reports = planner.background() + planner.patterns() + planner.bursts() + planner.recent()
    start = plan.end - timedelta(days=plan.days)
    return sorted((r for r in reports if start <= r.at < plan.end), key=lambda r: r.at)


class _Planner:
    """Arka plan bildirimleri + gomulu oruntuler + ayni anda bildirilen sorunlar."""

    def __init__(self, data: HistoryFile, plan: HistoryPlan, reporters: int) -> None:
        self._data = data
        self._plan = plan
        self._end = plan.end
        self._start = plan.end - timedelta(days=plan.days)
        self._reporters = reporters
        # Simulasyon, sifreleme degil: belirlenimci tohum istenir
        self._rng = random.Random(plan.seed)  # noqa: S311

    def background(self) -> list[Report]:
        types, weights = list(self._data.weights), list(self._data.weights.values())
        reports = []
        for day in range(self._plan.days):
            midnight = _local_midnight(self._start + timedelta(days=day))
            weekend = midnight.weekday() >= SATURDAY
            rate = self._plan.base_reports_per_day * (WEEKEND_FACTOR if weekend else 1)
            for _ in range(int(rate) + (self._rng.random() < rate % 1)):
                at = midnight + timedelta(minutes=self._minute_of_day(REPORT_END_HOUR))
                reports.append(self._report(self._rng.choices(types, weights)[0], at))
        return reports

    def patterns(self) -> list[Report]:
        window = min(self._plan.days, PATTERN_WINDOW_DAYS)
        reports = []
        for pattern in self._data.patterns:
            count = round(pattern.count * window / PATTERN_WINDOW_DAYS)
            for day in self._rng.sample(range(window), min(count, window)):
                midnight = _local_midnight(self._end - timedelta(days=window - day))
                minutes = pattern.hour * MINUTES_PER_HOUR + self._rng.randint(0, PATTERN_SPREAD)
                at = midnight + timedelta(minutes=minutes)
                reports.append(self._report(pattern.case_type, at, location=pattern.location))
        return reports

    def bursts(self) -> list[Report]:
        bursts = self._data.bursts
        count = max(1, round(bursts.count * self._plan.days / BURST_REFERENCE_DAYS))
        reports = []
        for _ in range(count):
            case_type = self._rng.choice(SPOT_BURST_TYPES)
            location = self._rng.choice(self._data.locations[case_type])
            day = timedelta(days=self._rng.randrange(self._plan.days))
            midnight = _local_midnight(self._start + day)
            first = midnight + timedelta(minutes=self._minute_of_day(WORKDAY_END_HOUR))
            people = self._rng.sample(range(self._reporters), self._rng.randint(*bursts.reporters))
            for index, reporter in enumerate(people):
                offset = 0 if index == 0 else self._rng.randint(1, bursts.within_minutes)
                at = first + timedelta(minutes=offset)
                reports.append(self._report(case_type, at, location=location, reporter=reporter))
        return reports

    def recent(self) -> list[Report]:
        """Gecmisin son saatlerinde gelenler: cogu henuz bitmemis olur (acik isler)."""
        types, weights = list(self._data.weights), list(self._data.weights.values())
        count = max(1, round(RECENT_REPORTS * self._plan.days / BURST_REFERENCE_DAYS))
        last = RECENT_MINUTES
        return [
            self._report(
                self._rng.choices(types, weights)[0],
                self._end - timedelta(minutes=self._rng.randint(1, last)),
            )
            for _ in range(count)
        ]

    def _minute_of_day(self, last_hour: int) -> int:
        return self._rng.randint(REPORT_START_HOUR * MINUTES_PER_HOUR, last_hour * MINUTES_PER_HOUR)

    def _report(
        self, case_type: str, at: datetime, location: str | None = None, reporter: int | None = None
    ) -> Report:
        return Report(
            at=at,
            case_type=case_type,
            location=location or self._rng.choice(self._data.locations[case_type]),
            text=self._rng.choice(self._data.phrases[case_type]),
            reporter=self._rng.randrange(self._reporters) if reporter is None else reporter,
        )


def _local_midnight(moment: datetime) -> datetime:
    local = moment.astimezone(TURKEY)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


# --- Kullanicilar ----------------------------------------------------------------------------


def _ensure_extra_users(
    session: Session, organization: Organization, extra: ExtraUsersSeed, password: str
) -> None:
    departments = {d.code: d.id for d in department_repository.list_all(session, organization.id)}
    # Ayni parola: hash bir kez hesaplanir (bilerek yavas bir islem)
    password_hash = hash_password(password)
    users = [
        User(
            organization_id=organization.id,
            email=EXTRA_REPORTER_EMAIL.format(index=index),
            password_hash=password_hash,
            full_name=f"Demo Öğrenci {index:02d}",
            role=UserRole.REPORTER,
            reporter_kind=ReporterKind.STUDENT,
        )
        for index in range(1, extra.reporters + 1)
    ]
    users += [
        User(
            organization_id=organization.id,
            email=staff.email,
            password_hash=password_hash,
            full_name=staff.full_name,
            role=UserRole.STAFF,
            department_id=departments[staff.department],
        )
        for staff in extra.staff
    ]
    for user in users:
        if user_repository.get_by_email(session, user.email) is None:
            user_repository.add(session, user)
    session.commit()


# --- Simulasyon ------------------------------------------------------------------------------


class _Simulation:
    def __init__(
        self, session: Session, organization: Organization, data: HistoryFile, clock: SimClock
    ) -> None:
        self._session = session
        self._data = data
        self._clock = clock
        self._rng = random.Random(organization.id)  # noqa: S311 - simulasyon
        self._queue = _Queue()
        users = session.scalars(
            select(User).where(User.organization_id == organization.id).order_by(User.id)
        ).all()
        self._reporters = [u for u in users if u.role is UserRole.REPORTER]
        self._staff = [u for u in users if u.role is UserRole.STAFF]
        self._managers = {u.email: u for u in users if u.role is UserRole.MANAGER}
        self._locations = {
            code: location_repository.get_by_code(session, organization.id, code)
            for codes in data.locations.values()
            for code in codes
        }
        self._organization_id = organization.id
        # Bildirimin gercek turu (yonetici duzeltmesi ve RQ1 icin dogru cevap)
        self._intended: dict[int, str] = {}
        self._created: list[int] = []

    @property
    def reporter_count(self) -> int:
        return len(self._reporters)

    def run(self, reports: list[Report], end: datetime) -> None:
        for report in reports:
            self._queue.push(report.at, lambda r=report: self._report(r))  # type: ignore[misc]
        tick = self._clock.now()
        while tick < end:
            self._queue.push(tick, self._monitor)
            tick += MONITOR_EVERY
        while self._queue.items and self._queue.items[0][0] < end:
            at, _, action = heapq.heappop(self._queue.items)
            self._clock.current = at
            action()

    def result(self) -> HistoryResult:
        statuses = self._session.scalars(
            select(Case.status).where(Case.id.in_(self._created))
        ).all()
        return HistoryResult(
            created=len(self._created), open=sum(s not in _TERMINAL for s in statuses)
        )

    # --- Bildirim ve analiz -----------------------------------------------------------------

    def _report(self, report: Report) -> None:
        reporter = self._reporters[report.reporter % len(self._reporters)]
        location = self._locations[report.location]
        if location is None:
            raise ValueError(f"Gecmis plani bilinmeyen lokasyon kullaniyor: {report.location}")
        created = CaseService(self._session, reporter, self._clock).create(
            CaseCreate(description=report.text, location_id=location.id)
        )
        case = self._case(created.id)
        case.is_seed = True
        self._session.commit()
        self._created.append(case.id)
        if report.case_type != MEANINGLESS:
            self._intended[case.id] = report.case_type
        self._analyze(case.id)

    def _analyze(self, case_id: int) -> None:
        AnalysisService(self._session, self._clock).analyze(case_id)
        self._after(case_id)

    def _after(self, case_id: int) -> None:
        """Bildirimin yeni durumuna gore siradaki insan adimini planlar."""
        step = _NEXT_STEP.get(self._case(case_id).status)
        if step is not None:
            step(self, case_id)

    def _plan_manager(self, case_id: int) -> None:
        self._later(MANAGER_DELAY, lambda: self._manager(case_id), work_hours=True)

    def _plan_reply(self, case_id: int) -> None:
        if self._rng.random() < INFO_REPLY_PROBABILITY:
            self._later(INFO_REPLY_DELAY, lambda: self._reply(case_id))

    def _plan_redo(self, case_id: int) -> None:
        """Resolution kanit istedi: personel isi aciklayip yeniden tamamlar."""
        task = self._active_task(case_id)
        if task is not None:
            staff = self._staff_for(task)
            self._later(START_DELAY, lambda: self._complete(case_id, staff))

    def _reply(self, case_id: int) -> None:
        case = self._case(case_id)
        if case.status is not CaseStatus.NEEDS_INFO:
            return
        case_type = self._rng.choice(SPOT_BURST_TYPES)
        self._intended[case_id] = case_type
        reporter = self._user(case.reporter_id)
        text = self._rng.choice(self._data.phrases[case_type])
        CaseInteractionService(self._session, reporter, self._clock).provide_info(
            case_id, InfoReplyCreate(body=text)
        )
        self._analyze(case_id)

    # --- Personel ---------------------------------------------------------------------------

    def _plan_accept(self, case_id: int) -> None:
        task = self._active_task(case_id)
        if task is None:
            return
        department = department_repository.get(self._session, task.department_id)
        if department is None:
            raise ValueError(f"Gorev {task.id}: birim yok")
        delay = self._data.departments[department.code].accept
        self._later(delay, lambda: self._accept(case_id), work_hours=True)

    def _accept(self, case_id: int) -> None:
        task = self._active_task(case_id)
        if task is None or task.accepted_at is not None:
            return
        staff = self._staff_for(task)
        TaskService(self._session, staff, self._clock, agents_enabled=True).accept(task.id)
        self._later(START_DELAY, lambda: self._start(case_id, staff))

    def _start(self, case_id: int, staff: User) -> None:
        task = self._active_task(case_id)
        if task is None:
            return
        TaskService(self._session, staff, self._clock, agents_enabled=True).start(task.id)
        case_type = self._intended.get(case_id, "")
        work = self._data.work_minutes.get(case_type, self._data.work_minutes["default"])
        self._later(work, lambda: self._complete(case_id, staff))

    def _complete(self, case_id: int, staff: User) -> None:
        task = self._active_task(case_id)
        if task is None:
            return
        notes = self._data.completion_notes
        failed = self._rng.random() < NOT_DONE_PROBABILITY
        note = self._rng.choice(notes.not_done if failed else notes.done)
        TaskService(self._session, staff, self._clock, agents_enabled=True).complete(
            task.id, CompleteRequest(completion_note=note)
        )
        self._after(case_id)

    def _staff_for(self, task: Task) -> User:
        if task.assigned_user_id is not None:
            return self._user(task.assigned_user_id)
        pool = [s for s in self._staff if s.department_id == task.department_id]
        return self._rng.choice(pool)

    # --- Mudur ------------------------------------------------------------------------------

    def _manager(self, case_id: int) -> None:
        case = self._case(case_id)
        manager = self._manager_for(case)
        if case.status is CaseStatus.VERIFICATION:
            ReviewService(self._session, manager, self._clock).close(
                case_id, CloseRequest(reason="Yerinde kontrol edildi.")
            )
            self._plan_feedback(case_id)
            return
        if case.status not in (
            CaseStatus.CLASSIFIED,
            CaseStatus.ESCALATED,
            CaseStatus.REOPENED,
        ):
            return
        self._decide(case, manager)

    def _decide(self, case: Case, manager: User) -> None:
        intended = self._intended.get(case.id)
        if intended is None or intended == "OUT_OF_SCOPE":
            ReviewService(self._session, manager, self._clock).reject(
                case.id, RejectRequest(reason="Anlaşılır bir sorun bildirilmemiş.")
            )
            return
        reviews = ReviewService(self._session, manager, self._clock)
        current = case.case_type.code if case.case_type else None
        if current != intended:
            # AI yanlis turu secti: mudur duzeltir (decision_feedback = yeniden egitim verisi)
            reviews.override(
                case.id,
                OverrideRequest(
                    field=OverrideField.CASE_TYPE, corrected_value=intended, reason=REVIEW_REASON
                ),
            )
        case_type = case_type_repository.get_by_code(self._session, case.organization_id, intended)
        if case_type is None or case_type.default_department_id is None:
            raise ValueError(f"Gecmis plani birimsiz tur kullaniyor: {intended}")
        TaskService(self._session, manager, self._clock, agents_enabled=True).assign(
            case.id, AssignRequest(department_id=case_type.default_department_id)
        )
        self._plan_accept(case.id)

    def _manager_for(self, case: Case) -> User:
        maintenance = department_repository.get_by_code(
            self._session, self._organization_id, "MAINTENANCE"
        )
        is_maintenance = maintenance is not None and case.department_id == maintenance.id
        return self._managers[MANAGER_FOR_MAINTENANCE if is_maintenance else DEFAULT_MANAGER]

    # --- Bildirim yapan ---------------------------------------------------------------------

    def _plan_feedback(self, case_id: int) -> None:
        if self._rng.random() < REOPEN_PROBABILITY:
            self._later(REOPEN_DELAY, lambda: self._reopen(case_id))
        elif self._rng.random() < FEEDBACK_PROBABILITY:
            self._later(FEEDBACK_DELAY, lambda: self._feedback(case_id))

    def _feedback(self, case_id: int) -> None:
        case = self._case(case_id)
        if case.status is not CaseStatus.CLOSED or case.satisfaction_rating is not None:
            return
        late = (
            case.due_at is not None
            and case.resolved_at is not None
            and (case.resolved_at > case.due_at)
        )
        rating = self._rng.choice(LATE_RATINGS if late else ON_TIME_RATINGS)
        reporter = self._user(case.reporter_id)
        CaseInteractionService(self._session, reporter, self._clock).feedback(
            case_id, FeedbackCreate(rating=rating)
        )

    def _reopen(self, case_id: int) -> None:
        case = self._case(case_id)
        if case.status is not CaseStatus.CLOSED:
            return
        reporter = self._user(case.reporter_id)
        CaseInteractionService(self._session, reporter, self._clock).reopen(
            case_id, ReopenRequest(reason=REOPEN_REASON)
        )
        self._after(case_id)

    # --- Yardimcilar ------------------------------------------------------------------------

    def _monitor(self) -> None:
        MonitoringService(self._session, self._clock, agents_enabled=True).tick()

    def _later(
        self, minutes: tuple[int, int], action: Callable[[], None], work_hours: bool = False
    ) -> None:
        at = self._clock.now() + timedelta(minutes=self._rng.randint(*minutes))
        self._queue.push(self._working_time(at) if work_hours else at, action)

    def _working_time(self, moment: datetime) -> datetime:
        """Personel ve mudur mesai disinda calismaz: is bir sonraki mesai basina kalir."""
        local = moment.astimezone(TURKEY)
        in_hours = WORKDAY_START_HOUR <= local.hour < WORKDAY_END_HOUR
        if local.weekday() != SUNDAY and in_hours:
            return moment
        day = local if local.hour < WORKDAY_START_HOUR else local + timedelta(days=1)
        while day.weekday() == SUNDAY:
            day += timedelta(days=1)
        start = day.replace(hour=WORKDAY_START_HOUR, minute=0, second=0, microsecond=0)
        return start + timedelta(minutes=self._rng.randint(*OFF_HOURS_SPREAD))

    def _user(self, user_id: int) -> User:
        user = self._session.get(User, user_id)
        if user is None:
            raise ValueError(f"Kullanici {user_id} bulunamadi")
        return user

    def _active_task(self, case_id: int) -> Task | None:
        return task_repository.active_for_case(self._session, case_id, list(ACTIVE_TASK_STATUSES))

    def _case(self, case_id: int) -> Case:
        # Iliskiler (tur, birim) de taze yuklenir
        case = case_repository.get(self._session, case_id)
        if case is None:
            raise ValueError(f"Bildirim {case_id} bulunamadi")
        return case


_NEXT_STEP: dict[CaseStatus, Callable[[_Simulation, int], None]] = {
    CaseStatus.ASSIGNED: _Simulation._plan_accept,
    CaseStatus.CLASSIFIED: _Simulation._plan_manager,
    CaseStatus.ESCALATED: _Simulation._plan_manager,
    CaseStatus.REOPENED: _Simulation._plan_manager,
    CaseStatus.VERIFICATION: _Simulation._plan_manager,
    CaseStatus.NEEDS_INFO: _Simulation._plan_reply,
    CaseStatus.IN_PROGRESS: _Simulation._plan_redo,
    CaseStatus.CLOSED: _Simulation._plan_feedback,
}
