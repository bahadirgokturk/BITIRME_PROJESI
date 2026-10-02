"""Monitoring Agent (K1, docs/AGENTS.md 4.8): acik bildirimleri periyodik izler.

Her bildirim icin anlik durumu (SLA durumu, durumda gecen sure, daha once uretilen uyarilar) servis
verir; agent hangi eylemlerin gerektigini soyler. Ayni uyari bir kez uretilir (bayraklar). Eylemleri
servis uygular; agent DB'ye dokunmaz.
"""

from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, Field

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.models.enums import CaseStatus, SlaStatus

# Agent hatti normalde saniyeler surer; bu kadar ANALYZING'de kalan bildirim takilmistir
ANALYZING_STUCK_MINUTES = 5
# Bildirim yapan 48 saatte yanit vermediyse bildirim kapanir (AGENTS.md 4.8)
NEEDS_INFO_TIMEOUT_MINUTES = 48 * 60
NO_ACTION = "NO_ACTION"


class MonitoringAction(StrEnum):
    SLA_WARNING = "SLA_WARNING"
    SLA_BREACHED = "SLA_BREACHED"
    RECOMMEND_REASSIGN = "RECOMMEND_REASSIGN"
    RERUN_ANALYSIS = "RERUN_ANALYSIS"
    CLOSE_UNANSWERED = "CLOSE_UNANSWERED"


class CaseSnapshot(BaseModel):
    case_id: int
    status: CaseStatus
    # Okuma anindaki SLA durumu (services/sla.py); SLA yoksa bos
    sla_status: SlaStatus | None
    minutes_in_status: float = Field(ge=0)
    # ASSIGNED ve kabul hedefi gecti
    response_overdue: bool
    # Bu uyarilar daha once uretildi mi (olay kaydi)
    warned: bool
    breached: bool
    reassign_recommended: bool


class PlannedAction(BaseModel):
    action: MonitoringAction
    message: str


class MonitoringOutput(BaseModel):
    actions: list[PlannedAction]


_MESSAGES: dict[MonitoringAction, str] = {
    MonitoringAction.SLA_WARNING: "Çözüm süresinin büyük kısmı doldu; bildirim riskte.",
    MonitoringAction.SLA_BREACHED: "Çözüm süresi aşıldı; müdüre yükseltildi.",
    MonitoringAction.RECOMMEND_REASSIGN: (
        "Görev kabul süresi içinde kabul edilmedi; başka personel önerilir."
    ),
    MonitoringAction.RERUN_ANALYSIS: "Analiz takıldı; agent hattı yeniden çalıştırılır.",
    MonitoringAction.CLOSE_UNANSWERED: (
        "Ek bilgi talebine 48 saat içinde yanıt gelmedi; bildirim kapatılır."
    ),
}


def _sla(snapshot: CaseSnapshot) -> MonitoringAction | None:
    if snapshot.sla_status is SlaStatus.BREACHED:
        return None if snapshot.breached else MonitoringAction.SLA_BREACHED
    if snapshot.sla_status is SlaStatus.AT_RISK and not snapshot.warned:
        return MonitoringAction.SLA_WARNING
    return None


def _reassign(snapshot: CaseSnapshot) -> MonitoringAction | None:
    waiting = snapshot.status is CaseStatus.ASSIGNED and snapshot.response_overdue
    return (
        MonitoringAction.RECOMMEND_REASSIGN
        if waiting and not snapshot.reassign_recommended
        else None
    )


# Bekleme durumlari: bu sureden uzun kalan bildirim icin eylem
_WAITING: dict[CaseStatus, tuple[int, MonitoringAction]] = {
    CaseStatus.ANALYZING: (ANALYZING_STUCK_MINUTES, MonitoringAction.RERUN_ANALYSIS),
    CaseStatus.NEEDS_INFO: (NEEDS_INFO_TIMEOUT_MINUTES, MonitoringAction.CLOSE_UNANSWERED),
}


def _stuck(snapshot: CaseSnapshot) -> MonitoringAction | None:
    rule = _WAITING.get(snapshot.status)
    if rule is None:
        return None
    limit, action = rule
    return action if snapshot.minutes_in_status >= limit else None


def _plan(snapshot: CaseSnapshot) -> MonitoringOutput:
    found = (_sla(snapshot), _reassign(snapshot), _stuck(snapshot))
    return MonitoringOutput(
        actions=[PlannedAction(action=a, message=_MESSAGES[a]) for a in found if a is not None]
    )


class MonitoringAgent:
    name: ClassVar[str] = "monitoring"
    version: ClassVar[str] = "1.0"

    def run(self, inp: CaseSnapshot, ctx: AgentContext) -> AgentResult[MonitoringOutput]:
        output, latency = timed(lambda: _plan(inp))
        reasons = [Reason(code=a.action.value, message=a.message) for a in output.actions]
        return AgentResult[MonitoringOutput](
            agent_name=self.name,
            decision=output.actions[0].action.value if output.actions else NO_ACTION,
            confidence=None,
            reasons=reasons,
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )
