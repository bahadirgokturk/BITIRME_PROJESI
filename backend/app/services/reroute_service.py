"""Reddedilen gorevin yeniden yonlendirilmesi (docs/AGENTS.md 4.6, WORKFLOW.md bolum 1).

Personel gorevi reddedince bildirim ESCALATED olur. Agent hatti aciksa Routing Agent ayni birimde,
bildirimi daha once reddedenler disindaki personelden en uygununu secer; servis yeni gorevi acar.
Uygun personel yoksa havuza dusurulmez (havuz reddedene de gorunur): manager karar verir.

`route_excluding` Monitoring'in "baska personel oner" eylemiyle ortaktir
(services/monitoring_service.py).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentResult
from app.agents.routing import RoutingAgent, RoutingInput, RoutingOutput, StaffCandidate
from app.core.clock import Clock
from app.models import Case, CaseType
from app.models.enums import ActorType, CaseEventType
from app.repositories import agent_decision_repository, analysis_repository, task_repository
from app.repositories.agent_decision_repository import DecisionRun
from app.services.workflow import Transition

AGENT = "routing"
# Bir kez otomatik yeniden atanir. Ikinci ret bildirimin kendisinde sorun olabilecegini gosterir
# (yanlis tur, parca gerekir): o zaman manager karar verir, agent personel arasinda dolastirmaz.
MAX_AUTO_REROUTES = 1


@dataclass(frozen=True)
class Routed:
    inp: RoutingInput
    result: AgentResult[RoutingOutput]


def route_excluding(
    session: Session, case: Case, excluded: frozenset[int], now: datetime
) -> Routed | None:
    """Gorevin birimindeki personelden (haric tutulanlar disinda) en uygununu Routing Agent secer.

    Birim gorevin birimidir: manager baska birime atamis olabilir, turun varsayilanina donulmez.
    Tur ya da birim yoksa None.
    """
    if case.department_id is None or case.case_type_id is None:
        return None
    # Iliski her yerde yuklu degil (gorevden gelen bildirim): tur kimlikle okunur
    case_type = session.get(CaseType, case.case_type_id)
    if case_type is None:
        return None
    facts = analysis_repository.staff_facts(
        session, case.department_id, case_type.id, now - analysis_repository.LOOKBACK
    )
    inp = RoutingInput(
        case_type_code=case_type.code,
        department_id=case.department_id,
        secondary_department_id=None,
        building_code=analysis_repository.building_code(case.location.path),
        staff=[StaffCandidate(**vars(f)) for f in facts if f.user_id not in excluded],
    )
    return Routed(inp=inp, result=RoutingAgent().run(inp, AgentContext(now=now)))


class Rerouter:
    def __init__(self, session: Session, clock: Clock) -> None:
        self._session = session
        self._clock = clock

    def next_assignee(self, case: Case) -> int | None:
        """Yeni gorevi alacak personel; None ise bildirim manager'da kalir."""
        declined = task_repository.declined_by(self._session, case.id)
        if len(declined) > MAX_AUTO_REROUTES:
            return None
        now = self._clock.now()
        routed = route_excluding(self._session, case, frozenset(declined), now)
        if routed is None:
            return None
        run = DecisionRun(case_id=case.id, run_id=uuid.uuid4(), at=now)
        result: AgentResult[BaseModel] = routed.result  # type: ignore[assignment]
        agent_decision_repository.record(self._session, run, routed.inp, result)
        return routed.result.output.assigned_user_id


def rerouted(event: CaseEventType, metadata: dict[str, object]) -> Transition:
    """Yeniden yonlendirme olayi: Routing Agent adina, zaman cizelgesinde ayirt edilir."""
    return Transition(
        event_type=event,
        actor_type=ActorType.AGENT,
        agent_name=AGENT,
        metadata={**metadata, "reroute": True},
    )
