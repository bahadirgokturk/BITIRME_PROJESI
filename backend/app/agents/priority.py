"""Priority Agent (K1, docs/AGENTS.md 4.5): aciklanabilir etki skoru (0-100) ve oncelik bandi.

Skor sinyal katkilarinin toplamidir; her katki arayuzde ayri bir cubuk olarak gosterilir
("neden HIGH?"). Iki taban vardir: turun baslangic onceligi (seed'deki priority) ve metindeki
guvenlik ifadesi (CRITICAL).
"""

from datetime import timedelta, timezone
from math import floor
from typing import ClassVar

from pydantic import BaseModel, Field

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.models.enums import Priority

# Sinyal ust sinirlari (docs/AGENTS.md 4.5 tablo). 0-100 olcekli girdiler bu araliga oranlanir
INPUT_SCALE = 100
SEVERITY_MAX = 40  # tur siddeti
LOCATION_MAX = 15  # lokasyon onemi
SAFETY_POINTS = 30
POINTS_PER_DUPLICATE = 2
DUPLICATE_MAX = 10
POINTS_PER_RECURRENCE = 2  # son 30 gunde ayni lokasyon + tur
RECURRENCE_MAX = 10
POINTS_PER_URGENCY_HINT = 5
URGENCY_MAX = 10
CLASS_HOURS_POINTS = 5
SCORE_MAX = 100

# Bant alt sinirlari (artan sirada): LOW 0-39, MEDIUM 40-64, HIGH 65-84, CRITICAL 85-100
BAND_FLOORS: dict[Priority, int] = {
    Priority.LOW: 0,
    Priority.MEDIUM: 40,
    Priority.HIGH: 65,
    Priority.CRITICAL: 85,
}
# Ders saati: hafta ici 08:00-18:00 Turkiye saati. Turkiye 2016'dan beri yaz saati uygulamiyor
# (sabit UTC+3).
# Sinav haftasi takvimi henuz yok (ileride agent_policies ya da akademik takvim tablosu)
TURKEY = timezone(timedelta(hours=3))
CLASS_DAYS = range(0, 5)  # Pazartesi-Cuma
CLASS_HOURS = range(8, 18)


class PriorityInput(BaseModel):
    base_severity: int = Field(ge=0, le=100)
    base_priority: Priority
    is_safety_related: bool
    # Metinde guvenlik ifadesi (Intake aciliyet ipucu ya da Classification guvenlik kurali)
    safety_signal: bool
    urgency_hints: list[str]
    location_importance: int = Field(ge=0, le=100)
    duplicate_count: int = Field(default=0, ge=0)
    recent_similar_count: int = Field(default=0, ge=0)


class Contribution(BaseModel):
    signal: str
    points: int
    max_points: int
    detail: str


class PriorityOutput(BaseModel):
    impact_score: int
    priority: Priority
    contributions: list[Contribution]


def priority_band(score: int) -> Priority:
    reached = [priority for priority, lower in BAND_FLOORS.items() if score >= lower]
    return reached[-1]


def _round(value: float) -> int:
    # Yarim degerler yukari (10.5 -> 11); Python round() bankaci yuvarlamasi yapar
    return floor(value + 0.5)


def _is_class_hours(ctx: AgentContext) -> bool:
    local = ctx.now.astimezone(TURKEY)
    return local.weekday() in CLASS_DAYS and local.hour in CLASS_HOURS


def _contributions(inp: PriorityInput, ctx: AgentContext) -> list[Contribution]:
    safety = inp.is_safety_related or inp.safety_signal
    candidates = [
        (
            "SEVERITY",
            _round(inp.base_severity * SEVERITY_MAX / INPUT_SCALE),
            SEVERITY_MAX,
            "Bildirim türünün ciddiyeti",
        ),
        ("SAFETY", SAFETY_POINTS if safety else 0, SAFETY_POINTS, "Güvenlikle ilgili bildirim"),
        (
            "LOCATION",
            _round(inp.location_importance * LOCATION_MAX / INPUT_SCALE),
            LOCATION_MAX,
            "Konumun önemi (yoğunluk, hijyen)",
        ),
        (
            "DUPLICATES",
            min(inp.duplicate_count * POINTS_PER_DUPLICATE, DUPLICATE_MAX),
            DUPLICATE_MAX,
            f"Aynı sorunu bildiren {inp.duplicate_count} kişi daha",
        ),
        (
            "TIME",
            CLASS_HOURS_POINTS if _is_class_hours(ctx) else 0,
            CLASS_HOURS_POINTS,
            "Ders saati içinde",
        ),
        (
            "RECURRENCE",
            min(inp.recent_similar_count * POINTS_PER_RECURRENCE, RECURRENCE_MAX),
            RECURRENCE_MAX,
            f"Son 30 günde aynı yerde {inp.recent_similar_count} benzer bildirim",
        ),
        (
            "URGENCY",
            min(len(inp.urgency_hints) * POINTS_PER_URGENCY_HINT, URGENCY_MAX),
            URGENCY_MAX,
            "Aciliyet ifadeleri: " + ", ".join(inp.urgency_hints),
        ),
    ]
    return [
        Contribution(signal=signal, points=points, max_points=maximum, detail=detail)
        for signal, points, maximum, detail in candidates
        if points > 0
    ]


def _apply_floors(score: int, inp: PriorityInput) -> tuple[int, list[Reason]]:
    reasons = []
    base_floor = BAND_FLOORS[inp.base_priority]
    if score < base_floor:
        score = base_floor
        reasons.append(
            Reason(
                code="BASE_PRIORITY_FLOOR",
                message=f"Bu tür en az {inp.base_priority.value} öncelikle başlar.",
            )
        )
    critical = BAND_FLOORS[Priority.CRITICAL]
    if inp.safety_signal and score < critical:
        score = critical
        reasons.append(
            Reason(
                code="SAFETY_FLOOR",
                message="Metinde güvenlik açısından kritik ifade var; öncelik en az CRITICAL.",
            )
        )
    return score, reasons


class PriorityAgent:
    name: ClassVar[str] = "priority"
    version: ClassVar[str] = "1.0"

    def run(self, inp: PriorityInput, ctx: AgentContext) -> AgentResult[PriorityOutput]:
        (output, reasons), latency = timed(lambda: _score(inp, ctx))
        return AgentResult[PriorityOutput](
            agent_name=self.name,
            decision=output.priority.value,
            confidence=None,
            reasons=reasons,
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )


def _score(inp: PriorityInput, ctx: AgentContext) -> tuple[PriorityOutput, list[Reason]]:
    contributions = _contributions(inp, ctx)
    raw = min(sum(c.points for c in contributions), SCORE_MAX)
    score, floor_reasons = _apply_floors(raw, inp)
    reasons = [
        Reason(code=c.signal, message=c.detail, weight=float(c.points)) for c in contributions
    ]
    output = PriorityOutput(
        impact_score=score, priority=priority_band(score), contributions=contributions
    )
    return output, reasons + floor_reasons
