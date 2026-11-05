"""Routing Agent (K1, docs/AGENTS.md 4.6): birimi ve gorevi alacak personeli secer.

Birim, turun birincil birimidir (docs/DEPARTMENTS.md); ikincil birim yalniz bilgilendirilir.
Personel puani: -acik_gorev * 1 - (baska binada ? 0.5 : 0) + min(tecrube, 5) * 0.2. Esitlikte kucuk
kullanici id'si (tekrarlanabilir). Uygun personel yoksa gorev birim havuzuna duser.
Agirliklar varsayimdir; gercek atama verisi ve manager duzeltmeleriyle (E5-9) ayarlanacak.
"""

from typing import ClassVar

from pydantic import BaseModel, Field

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed

OPEN_TASK_WEIGHT = 1.0
# Baska binadaki personel: yaklasik yarim gorevlik yol
OTHER_BUILDING_PENALTY = 0.5
EXPERIENCE_WEIGHT = 0.2  # son 30 gunde ayni turde tamamlanan is basina
# Tecrube bonusu en fazla 1 gorevlik yuk farkini kapatir; yogun "uzman" bosta olanin onune gecmez
EXPERIENCE_CAP = 5
# Bu kadar acik gorevi olan personele yeni is verilmez (havuza duser)
MAX_OPEN_TASKS = 5
# Gerekcede gosterilen aday sayisi
TOP_CANDIDATES = 3
SCORE_DIGITS = 2


class StaffCandidate(BaseModel):
    user_id: int
    open_task_count: int = Field(ge=0)
    # Personelin aktif gorevinin binasi; aktif gorevi yoksa bilinmez (None)
    current_building: str | None
    recent_same_type_count: int = Field(ge=0)


class RoutingInput(BaseModel):
    case_type_code: str
    # Turun birincil birimi; OTHER ve OUT_OF_SCOPE icin yok
    department_id: int | None
    secondary_department_id: int | None
    # Bildirimin bina kodu (lokasyon yolunun ikinci parcasi)
    building_code: str | None
    # Birimin aktif STAFF uyeleri (servis doldurur)
    staff: list[StaffCandidate]


class CandidateScore(BaseModel):
    user_id: int
    score: float


class RoutingOutput(BaseModel):
    department_id: int | None
    secondary_department_id: int | None
    assigned_user_id: int | None
    candidates: list[CandidateScore]


def _score(candidate: StaffCandidate, building: str | None) -> float:
    elsewhere = candidate.current_building is not None and candidate.current_building != building
    experience = min(candidate.recent_same_type_count, EXPERIENCE_CAP)
    score = (
        -candidate.open_task_count * OPEN_TASK_WEIGHT
        - (OTHER_BUILDING_PENALTY if elsewhere else 0.0)
        + experience * EXPERIENCE_WEIGHT
    )
    return round(score, SCORE_DIGITS)


def _ranked(inp: RoutingInput) -> list[CandidateScore]:
    available = [s for s in inp.staff if s.open_task_count < MAX_OPEN_TASKS]
    scored = [
        CandidateScore(user_id=s.user_id, score=_score(s, inp.building_code)) for s in available
    ]
    return sorted(scored, key=lambda c: (-c.score, c.user_id))


def _route(inp: RoutingInput) -> tuple[str, RoutingOutput, list[Reason]]:
    if inp.department_id is None:
        output = RoutingOutput(
            department_id=None, secondary_department_id=None, assigned_user_id=None, candidates=[]
        )
        reason = Reason(
            code="NO_DEPARTMENT",
            message="Bu tür için görev alan birim yok; insan inceler ya da kapsam dışıdır.",
        )
        return "NO_DEPARTMENT", output, [reason]
    ranked = _ranked(inp)
    best = ranked[0] if ranked else None
    reasons = [_staff_reason(best, ranked)]
    if inp.secondary_department_id is not None:
        reasons.append(
            Reason(code="SECONDARY_INFORMED", message="İkinci birim yalnız bilgilendirilir.")
        )
    output = RoutingOutput(
        department_id=inp.department_id,
        secondary_department_id=inp.secondary_department_id,
        assigned_user_id=best.user_id if best else None,
        candidates=ranked[:TOP_CANDIDATES],
    )
    return ("ASSIGN_STAFF" if best else "ROUTE_TO_POOL"), output, reasons


def _staff_reason(best: CandidateScore | None, ranked: list[CandidateScore]) -> Reason:
    if best is None:
        return Reason(
            code="NO_AVAILABLE_STAFF",
            message="Uygun personel yok; görev birimin havuzuna düşer.",
        )
    top = [c.model_dump() for c in ranked[:TOP_CANDIDATES]]
    return Reason(
        code="STAFF_SELECTED",
        message="En az iş yükü, aynı bina ve bu işteki tecrübeye göre seçildi.",
        weight=best.score,
        evidence={"candidates": top},
    )


class RoutingAgent:
    name: ClassVar[str] = "routing"
    version: ClassVar[str] = "1.0"

    def run(self, inp: RoutingInput, ctx: AgentContext) -> AgentResult[RoutingOutput]:
        (decision, output, reasons), latency = timed(lambda: _route(inp))
        return AgentResult[RoutingOutput](
            agent_name=self.name,
            decision=decision,
            confidence=None,
            reasons=reasons,
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )
