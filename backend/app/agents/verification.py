"""Verification Agent (K1, docs/AGENTS.md 4.4): bildirimin gercek ve tutarli olma guveni (0..1).

Baslangic 0.40; her sinyal skoru artirir ya da azaltir ve gerekceye yazilir. Supervisor cok dusuk
skorda ek bilgi ister (REQUEST_MORE_INFO); karar Supervisor'indir.
"""

from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, Field

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed

BASE_SCORE = 0.40
PHOTO_BONUS = 0.20
DUPLICATE_BONUS = 0.15  # en az bir baska kisi ayni sorunu bildirmis
MANY_DUPLICATES = 3
MANY_DUPLICATES_BONUS = 0.25
LOCATION_CONSISTENT_BONUS = 0.15
LOCATION_MISMATCH_PENALTY = -0.15
VERIFIED_BEFORE_BONUS = 0.10  # ayni lokasyon + turde daha once dogrulanmis bildirim
MEANINGLESS_PENALTY = -0.20
# Bildirim yapanin gecmisi: az bildirimde oran yaniltici, yargiya varilmaz
REPORTER_MIN_CASES = 3
REPORTER_TRUSTED_RATIO = 0.10  # reddedilen orani bunun altindaysa guvenilir
REPORTER_TRUSTED_BONUS = 0.10
REPORTER_UNRELIABLE_RATIO = 0.50
REPORTER_UNRELIABLE_PENALTY = -0.20
# Seviye sinirlari: LOW < 0.4 <= MEDIUM < 0.7 <= HIGH
MEDIUM_FROM = 0.40
HIGH_FROM = 0.70
# Kayan nokta toplamini (0.75000000001) gosterilebilir yapmak icin
SCORE_DIGITS = 2


class VerificationLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class VerificationInput(BaseModel):
    has_photo: bool
    duplicate_count: int = Field(ge=0)
    # Intake: None = metinde lokasyon ipucu yok
    location_consistency: bool | None
    reporter_case_count: int = Field(ge=0)
    reporter_rejected_count: int = Field(ge=0)
    verified_before_here: bool
    is_meaningful: bool


class Adjustment(BaseModel):
    signal: str
    delta: float
    detail: str


class VerificationOutput(BaseModel):
    score: float
    level: VerificationLevel
    contributions: list[Adjustment]


def verification_level(score: float) -> VerificationLevel:
    if score >= HIGH_FROM:
        return VerificationLevel.HIGH
    return VerificationLevel.MEDIUM if score >= MEDIUM_FROM else VerificationLevel.LOW


def _duplicates(count: int) -> Adjustment | None:
    if count == 0:
        return None
    delta = MANY_DUPLICATES_BONUS if count >= MANY_DUPLICATES else DUPLICATE_BONUS
    return Adjustment(
        signal="DUPLICATES", delta=delta, detail=f"Aynı sorunu {count} kişi daha bildirdi"
    )


def _location(consistency: bool | None) -> Adjustment | None:
    if consistency is None:
        return None
    if consistency:
        return Adjustment(
            signal="LOCATION_CONSISTENT",
            delta=LOCATION_CONSISTENT_BONUS,
            detail="Metindeki yer bilgisi seçilen konumla uyumlu",
        )
    return Adjustment(
        signal="LOCATION_MISMATCH",
        delta=LOCATION_MISMATCH_PENALTY,
        detail="Metindeki yer bilgisi seçilen konumla çelişiyor",
    )


def _reporter(cases: int, rejected: int) -> Adjustment | None:
    if cases < REPORTER_MIN_CASES:
        return None
    ratio = rejected / cases
    if ratio <= REPORTER_TRUSTED_RATIO:
        return Adjustment(
            signal="REPORTER_HISTORY",
            delta=REPORTER_TRUSTED_BONUS,
            detail="Bildirim yapanın önceki bildirimleri genelde doğru çıkmış",
        )
    if ratio >= REPORTER_UNRELIABLE_RATIO:
        return Adjustment(
            signal="REPORTER_HISTORY",
            delta=REPORTER_UNRELIABLE_PENALTY,
            detail="Bildirim yapanın önceki bildirimlerinin çoğu reddedilmiş",
        )
    return None


def _adjustments(inp: VerificationInput) -> list[Adjustment]:
    optional = [
        Adjustment(signal="PHOTO", delta=PHOTO_BONUS, detail="Fotoğraf eklenmiş")
        if inp.has_photo
        else None,
        _duplicates(inp.duplicate_count),
        _location(inp.location_consistency),
        _reporter(inp.reporter_case_count, inp.reporter_rejected_count),
        Adjustment(
            signal="VERIFIED_BEFORE",
            delta=VERIFIED_BEFORE_BONUS,
            detail="Aynı yerde aynı sorun daha önce doğrulanmış",
        )
        if inp.verified_before_here
        else None,
        None
        if inp.is_meaningful
        else Adjustment(
            signal="TEXT_MEANINGLESS",
            delta=MEANINGLESS_PENALTY,
            detail="Açıklama anlaşılır değil ya da çok kısa",
        ),
    ]
    return [adjustment for adjustment in optional if adjustment is not None]


def _verify(inp: VerificationInput) -> VerificationOutput:
    adjustments = _adjustments(inp)
    raw = BASE_SCORE + sum(a.delta for a in adjustments)
    score = round(min(max(raw, 0.0), 1.0), SCORE_DIGITS)
    return VerificationOutput(
        score=score, level=verification_level(score), contributions=adjustments
    )


class VerificationAgent:
    name: ClassVar[str] = "verification"
    version: ClassVar[str] = "1.0"

    def run(self, inp: VerificationInput, ctx: AgentContext) -> AgentResult[VerificationOutput]:
        output, latency = timed(lambda: _verify(inp))
        reasons = [
            Reason(code=a.signal, message=a.detail, weight=a.delta) for a in output.contributions
        ]
        return AgentResult[VerificationOutput](
            agent_name=self.name,
            decision=output.level.value,
            confidence=output.score,
            reasons=reasons,
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )
