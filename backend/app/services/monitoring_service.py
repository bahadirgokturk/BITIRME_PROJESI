"""Monitoring (E5-10, docs/AGENTS.md 4.8): acik bildirimleri periyodik izler ve agent'in onerdigi
eylemleri uygular.

- SLA riski: SLA_WARNING olayi (bir kez). Asim: SLA_BREACHED + ESCALATED olayi, escalation_level
  artar; durum degismez (devam eden is bozulmaz, docs/WORKFLOW.md).
- Kabul edilmeyen gorev: REASSIGN_RECOMMENDED (Routing ile baska personel onerisi, bir kez).
- Takilan analiz: agent hatti yeniden calisir (hat kapaliysa manager bekler, izlenmez).
- 48 saat yanitsiz ek bilgi talebi: REJECTED.

Zamanlayici uygulama icinde calisir (Celery/Redis yok, ADR-8). Birden fazla sunucu ayaktaysa turu
Postgres advisory lock alan tek sunucu yapar.
"""

import asyncio
import logging
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.monitoring import (
    CaseSnapshot,
    MonitoringAction,
    MonitoringAgent,
    PlannedAction,
)
from app.agents.routing import RoutingAgent, RoutingInput, StaffCandidate
from app.core.clock import Clock
from app.models import Case
from app.models.enums import ActorType, CaseEventType, CaseStatus
from app.repositories import analysis_repository, monitoring_repository
from app.repositories.agent_decision_repository import DecisionRun, record
from app.services.analysis_service import LOOKBACK, AnalysisService
from app.services.sla import case_sla_status
from app.services.workflow import Transition, WorkflowService

AGENT = "monitoring"
# Advisory lock anahtari: uygulamada tek kullanim, herhangi bir sabit bigint
MONITORING_LOCK_KEY = 51_0010
SECONDS_PER_MINUTE = 60
# SLA'si isleyen ya da beklemede olan durumlar; cozulmus/kapali bildirimler izlenmez
_SLA_RUNNING = frozenset(
    {
        CaseStatus.ASSIGNED,
        CaseStatus.ACCEPTED,
        CaseStatus.IN_PROGRESS,
        CaseStatus.ESCALATED,
        CaseStatus.REOPENED,
    }
)

logger = logging.getLogger(__name__)


class MonitoringService:
    def __init__(self, session: Session, clock: Clock, agents_enabled: bool) -> None:
        self._session = session
        self._clock = clock
        self._agents_enabled = agents_enabled
        self._workflow = WorkflowService(session, clock)

    def tick(self) -> int:
        """Bir izleme turu; uygulanan eylem sayisini dondurur."""
        statuses = _SLA_RUNNING | {CaseStatus.NEEDS_INFO}
        if self._agents_enabled:
            # Hat kapaliyken ANALYZING bilincli bekleyistir (manager atar); takilma sayilmaz
            statuses |= {CaseStatus.ANALYZING}
        applied = sum(
            self._check(case) for case in monitoring_repository.open_cases(self._session, statuses)
        )
        self._session.commit()
        return applied

    def _check(self, case: Case) -> int:
        now = self._clock.now()
        snapshot = self._snapshot(case, now)
        result = MonitoringAgent().run(snapshot, AgentContext(now=now))
        actions = result.output.actions
        if not actions:
            return 0
        run = DecisionRun(case_id=case.id, run_id=uuid.uuid4(), at=now)
        record(self._session, run, snapshot, result)  # type: ignore[arg-type]
        for planned in actions:
            _APPLY[planned.action](self, case, planned)
        return len(actions)

    def _snapshot(self, case: Case, now: datetime) -> CaseSnapshot:
        entered = monitoring_repository.entered_status_at(self._session, case)
        response_due = case.response_due_at

        def sent(event: CaseEventType, since: datetime | None = None) -> bool:
            return monitoring_repository.has_event(self._session, case.id, event, since)

        return CaseSnapshot(
            case_id=case.id,
            status=case.status,
            sla_status=case_sla_status(case, now) if case.status in _SLA_RUNNING else None,
            minutes_in_status=max((now - entered).total_seconds(), 0) / SECONDS_PER_MINUTE,
            response_overdue=response_due is not None and now > response_due,
            warned=sent(CaseEventType.SLA_WARNING),
            breached=sent(CaseEventType.SLA_BREACHED),
            # Oneri her atama icin bir kez: son ASSIGNED'a giristen beri
            reassign_recommended=sent(CaseEventType.REASSIGN_RECOMMENDED, entered),
        )

    # --- Eylemler -----------------------------------------------------------------------

    def _warn(self, case: Case, planned: PlannedAction) -> None:
        self._record(case, CaseEventType.SLA_WARNING, {"message": planned.message})

    def _breach(self, case: Case, planned: PlannedAction) -> None:
        case.escalation_level += 1
        self._record(case, CaseEventType.SLA_BREACHED, {"message": planned.message})
        self._record(case, CaseEventType.ESCALATED, {"escalation_level": case.escalation_level})

    def _recommend_reassign(self, case: Case, planned: PlannedAction) -> None:
        metadata: dict[str, object] = {
            "message": planned.message,
            "suggested_user_id": self._other_staff(case),
        }
        self._record(case, CaseEventType.REASSIGN_RECOMMENDED, metadata)

    def _rerun_analysis(self, case: Case, planned: PlannedAction) -> None:
        AnalysisService(self._session, self._clock).analyze(case.id)

    def _close_unanswered(self, case: Case, planned: PlannedAction) -> None:
        case.info_request = None
        rejected = _agent(CaseEventType.CASE_REJECTED, {"reason": planned.message})
        self._workflow.transition(case, CaseStatus.REJECTED, rejected)

    # --- Yardimcilar --------------------------------------------------------------------

    def _other_staff(self, case: Case) -> int | None:
        """Routing Agent ile ayni birimden, su anki personel disinda en uygun kisi."""
        case_type = case.case_type
        if case.department_id is None or case_type is None:
            return None
        since = self._clock.now() - LOOKBACK
        facts = analysis_repository.staff_facts(
            self._session, case.department_id, case_type.id, since
        )
        staff = [StaffCandidate(**vars(f)) for f in facts if f.user_id != case.assigned_staff_id]
        routing = RoutingAgent().run(
            RoutingInput(
                case_type_code=case_type.code,
                department_id=case.department_id,
                secondary_department_id=None,
                building_code=analysis_repository.building_code(case.location.path),
                staff=staff,
            ),
            AgentContext(now=self._clock.now()),
        )
        return routing.output.assigned_user_id

    def _record(self, case: Case, event: CaseEventType, metadata: dict[str, object]) -> None:
        self._workflow.record(case, _agent(event, metadata), self._clock.now())


_APPLY: dict[MonitoringAction, Callable[[MonitoringService, Case, PlannedAction], None]] = {
    MonitoringAction.SLA_WARNING: MonitoringService._warn,
    MonitoringAction.SLA_BREACHED: MonitoringService._breach,
    MonitoringAction.RECOMMEND_REASSIGN: MonitoringService._recommend_reassign,
    MonitoringAction.RERUN_ANALYSIS: MonitoringService._rerun_analysis,
    MonitoringAction.CLOSE_UNANSWERED: MonitoringService._close_unanswered,
}


def _agent(event: CaseEventType, metadata: dict[str, object]) -> Transition:
    return Transition(
        event_type=event, actor_type=ActorType.AGENT, agent_name=AGENT, metadata=metadata
    )


def run_locked(session: Session, work: Callable[[Session], object]) -> bool:
    """Kilidi alabilirse isi yapar; baska sunucu turdaysa bu tur atlanir.

    Kilit oturum seviyesindedir: tur icindeki commit'ler (yeniden analiz) kilidi birakmaz. Bu yuzden
    oturum tek bir baglantiya bagli olmalidir.
    """
    key = {"key": MONITORING_LOCK_KEY}
    if not session.scalar(text("SELECT pg_try_advisory_lock(:key)"), key):
        return False
    try:
        work(session)
    finally:
        session.execute(text("SELECT pg_advisory_unlock(:key)"), key)
        session.commit()
    return True


async def monitoring_loop(
    engine: Engine, clock: Clock, interval: timedelta, agents_enabled: bool
) -> None:
    """Uygulama acikken her `interval`'da bir tur. Veritabani hatasi donguyu durdurmaz."""
    while True:
        await asyncio.sleep(interval.total_seconds())
        try:
            await asyncio.to_thread(_tick_once, engine, clock, agents_enabled)
        except SQLAlchemyError:
            # Gecici DB sorunu (baglanti koptu): kaydet, sonraki turda yeniden dene
            logger.exception("Izleme turu veritabani hatasiyla bitti")


def _tick_once(engine: Engine, clock: Clock, agents_enabled: bool) -> None:
    # Tek baglanti: kilit ve tur ayni baglantida (oturum seviyesi kilit)
    with (
        engine.connect() as connection,
        Session(bind=connection, expire_on_commit=False) as session,
    ):
        ran = run_locked(
            session, lambda s: MonitoringService(s, clock, agents_enabled=agents_enabled).tick()
        )
        if not ran:
            logger.info("Izleme turu baska sunucuda; atlandi")
