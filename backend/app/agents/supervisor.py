"""Supervisor Agent (K1, docs/AGENTS.md 4.7): deterministik karar tablosu, LLM yok.

Kurallar sirayla degerlendirilir, ilk eslesen kazanir. Gerekce tetiklenen kurali ve diger
agent'larin kullanilan degerlerini icerir. Supervisor yalniz karar verir; uygulamayi orchestrator
servisi yapar.
"""

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, Field

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.agents.duplicate import DUPLICATE_FROM, POSSIBLE_DUPLICATE_FROM
from app.models.enums import AutonomyLevel, Priority

# Bunun altinda bildirim dogrulanamaz sayilir: bildirim yapandan ek bilgi istenir
VERIFICATION_MIN = 0.20
# Benzerlik esikleri Duplicate Agent ile ortak: ustu ayni sorun, arasi insan incelemesine gider
DUPLICATE_MERGE_FROM = DUPLICATE_FROM
DUPLICATE_REVIEW_FROM = POSSIBLE_DUPLICATE_FROM
OUT_OF_SCOPE_CODE = "OUT_OF_SCOPE"


class SupervisorDecision(StrEnum):
    REQUEST_MORE_INFO = "REQUEST_MORE_INFO"
    MERGE_WITH_EXISTING_CASE = "MERGE_WITH_EXISTING_CASE"
    ESCALATE = "ESCALATE"
    REJECT_OUT_OF_SCOPE = "REJECT_OUT_OF_SCOPE"
    SEND_TO_HUMAN_REVIEW = "SEND_TO_HUMAN_REVIEW"
    AUTO_ASSIGN = "AUTO_ASSIGN"
    CREATE_TASK = "CREATE_TASK"


# Manager'in karar vermesi gereken sonuclar (inceleme kuyrugu)
_HUMAN_REVIEW = frozenset({SupervisorDecision.ESCALATE, SupervisorDecision.SEND_TO_HUMAN_REVIEW})
# Gorev olusan sonuclar; L2 tiplerde manager bilgilendirilir
_TASK_CREATED = frozenset({SupervisorDecision.AUTO_ASSIGN, SupervisorDecision.CREATE_TASK})


class SupervisorInput(BaseModel):
    is_meaningful: bool
    verification_score: float = Field(ge=0, le=1)
    duplicate_probability: float = Field(ge=0, le=1)
    case_type_code: str
    autonomy: AutonomyLevel
    min_confidence_auto: float = Field(ge=0, le=1)
    # None: guven bilinmiyor (otomatik karara yetmez)
    classification_confidence: float | None
    priority: Priority
    # Classification: metindeki guvenlik ifadesi
    safety_term: str | None
    # Routing karari: ASSIGN_STAFF | ROUTE_TO_POOL | NO_DEPARTMENT
    routing_decision: str


class SupervisorOutput(BaseModel):
    decision: SupervisorDecision
    rule: int
    needs_human_review: bool
    notify_manager: bool


@dataclass(frozen=True)
class _Rule:
    number: int
    decision: SupervisorDecision
    applies: Callable[[SupervisorInput], bool]
    message: str


def _unsure(inp: SupervisorInput) -> bool:
    confidence = inp.classification_confidence
    low_confidence = confidence is None or confidence < inp.min_confidence_auto
    possible_duplicate = DUPLICATE_REVIEW_FROM <= inp.duplicate_probability < DUPLICATE_MERGE_FROM
    return low_confidence or possible_duplicate or inp.routing_decision == "NO_DEPARTMENT"


RULES: tuple[_Rule, ...] = (
    _Rule(
        1,
        SupervisorDecision.REQUEST_MORE_INFO,
        lambda i: not i.is_meaningful or i.verification_score < VERIFICATION_MIN,
        "Bildirim anlaşılır değil ya da doğrulanamıyor; bildirim yapandan ek bilgi istenir.",
    ),
    _Rule(
        2,
        SupervisorDecision.MERGE_WITH_EXISTING_CASE,
        lambda i: i.duplicate_probability >= DUPLICATE_MERGE_FROM,
        "Aynı sorun zaten bildirilmiş; mevcut bildirimle birleştirilir.",
    ),
    _Rule(
        3,
        SupervisorDecision.ESCALATE,
        lambda i: (
            i.autonomy is AutonomyLevel.L3_ESCALATE
            or i.priority is Priority.CRITICAL
            or i.safety_term is not None
        ),
        "Güvenlik açısından kritik ya da insan kararı gerektiren tür; müdüre iletilir.",
    ),
    _Rule(
        4,
        SupervisorDecision.REJECT_OUT_OF_SCOPE,
        lambda i: i.case_type_code == OUT_OF_SCOPE_CODE,
        "Talep kampüs tesis hizmetleri kapsamında değil; ilgili birime yönlendirilir.",
    ),
    _Rule(
        5,
        SupervisorDecision.SEND_TO_HUMAN_REVIEW,
        _unsure,
        "Sınıflandırma ya da yönlendirme yeterince kesin değil; müdür inceler.",
    ),
    _Rule(
        6,
        SupervisorDecision.AUTO_ASSIGN,
        lambda i: i.routing_decision == "ASSIGN_STAFF",
        "Uygun personele otomatik atanır.",
    ),
    _Rule(
        7,
        SupervisorDecision.CREATE_TASK,
        lambda i: True,
        "Uygun personel yok; görev birimin havuzuna düşer.",
    ),
)


def _decide(inp: SupervisorInput) -> tuple[SupervisorOutput, Reason]:
    rule = next(r for r in RULES if r.applies(inp))
    output = SupervisorOutput(
        decision=rule.decision,
        rule=rule.number,
        needs_human_review=rule.decision in _HUMAN_REVIEW,
        notify_manager=(rule.decision in _TASK_CREATED and inp.autonomy is AutonomyLevel.L2_NOTIFY),
    )
    reason = Reason(
        code=f"RULE_{rule.number}_{rule.decision.value}",
        message=rule.message,
        evidence=inp.model_dump(mode="json"),
    )
    return output, reason


class SupervisorAgent:
    name: ClassVar[str] = "supervisor"
    version: ClassVar[str] = "1.0"

    def run(self, inp: SupervisorInput, ctx: AgentContext) -> AgentResult[SupervisorOutput]:
        (output, reason), latency = timed(lambda: _decide(inp))
        return AgentResult[SupervisorOutput](
            agent_name=self.name,
            decision=output.decision.value,
            confidence=None,
            reasons=[reason],
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )
