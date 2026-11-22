"""Photo Check Agent (K1): bildirim fotografi metinden cikan turle uyusuyor mu.

Fotograf, bildirimden sonra ayri istekle yuklenir; agent hatti o sirada fotografi gormez. Bu yuzden
kontrol yukleme aninda calisir: Vision Agent'in onerileri (ilk 3) Classification'in turuyle
karsilastirilir. Karar yalniz kanit ve uyaridir; turu degistirmez (docs/AGENTS.md 4.12).
"""

from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.agents.vision import TypeSuggestion

# Fotograf baska bir turu bu guvenle gosteriyorsa celiski sayilir; altinda "anlasilamadi"
# (oneri esigi 0.35 iken celiski icin daha emin olmak gerekir: yanlis alarm manager'i yorar)
CONFLICT_FROM = 0.60


class PhotoCheckDecision(StrEnum):
    AGREES = "AGREES"
    CONFLICTS = "CONFLICTS"
    UNCLEAR = "UNCLEAR"


class PhotoCheckInput(BaseModel):
    # Classification karari (bildirimin turu)
    case_type_code: str
    # Vision Agent onerileri, en olasi ustte
    suggestions: list[TypeSuggestion]


class PhotoCheckOutput(BaseModel):
    photo_suggestions: list[TypeSuggestion]


def _decide(inp: PhotoCheckInput) -> PhotoCheckDecision:
    codes = [s.case_type_code for s in inp.suggestions]
    if inp.case_type_code in codes:
        return PhotoCheckDecision.AGREES
    if inp.suggestions and inp.suggestions[0].confidence >= CONFLICT_FROM:
        return PhotoCheckDecision.CONFLICTS
    return PhotoCheckDecision.UNCLEAR


_MESSAGES: dict[PhotoCheckDecision, str] = {
    PhotoCheckDecision.AGREES: "Fotoğraf, bildirimin türüyle uyumlu.",
    PhotoCheckDecision.CONFLICTS: "Fotoğraf başka bir sorun gösteriyor; tür kontrol edilmeli.",
    PhotoCheckDecision.UNCLEAR: "Fotoğraftan sorun türü anlaşılamadı.",
}


class PhotoCheckAgent:
    name: ClassVar[str] = "photo_check"
    version: ClassVar[str] = "1.0"

    def run(self, inp: PhotoCheckInput, ctx: AgentContext) -> AgentResult[PhotoCheckOutput]:
        decision, latency = timed(lambda: _decide(inp))
        best = inp.suggestions[0] if inp.suggestions else None
        evidence = (
            {"photo_type": best.case_type_code, "text_type": inp.case_type_code} if best else {}
        )
        return AgentResult[PhotoCheckOutput](
            agent_name=self.name,
            decision=decision.value,
            confidence=best.confidence if best else None,
            reasons=[Reason(code=decision.value, message=_MESSAGES[decision], evidence=evidence)],
            output=PhotoCheckOutput(photo_suggestions=inp.suggestions),
            model=RULES_MODEL,
            latency_ms=latency,
        )
