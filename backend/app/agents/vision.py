"""Vision Agent (K2): fotograftan bildirim turu onerisi (proje plani 4.2 "fotograftan tur").

CLIP goruntu vektoru, her tur icin onceden hesaplanmis cumle vektorleriyle (istem bankasi,
ml_models/vision/v1) karsilastirilir; egitim verisi gerekmez (zero-shot). Tur skoru turun
cumlelerine dusen olasiliklarin toplamidir. Agent DB'ye ve dosyaya dokunmaz: goruntu vektorunu
servis uretir. Karar yalniz oneridir; turu yine Classification Agent metinden belirler.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

import numpy as np
from pydantic import BaseModel, Field

from app.agents.base import AgentContext, AgentResult, Reason, timed

VISION_MODEL = "clip-vit-b32-int8@1.0"
# CLIP'in egitimde ogrendigi sicaklik (logit_scale = 100): benzerlik farklari olasiliga boyle doner
LOGIT_SCALE = 100.0
# En olasi tur bu payin altindaysa fotograf "anlasilmadi" sayilir (uc turun esit oldugu durum 0.33)
SUGGEST_FROM = 0.35
# Ilk oneriden sonra listelenecek turlerin alt siniri: cok dusuk ihtimaller kullaniciyi yaniltir
LIST_FROM = 0.10
MAX_SUGGESTIONS = 3
# Sorun gostermeyen fotograf (kisi, bina disi, ekran goruntusu); kazanirsa oneri verilmez
NONE_LABEL = "_NONE"
CONFIDENCE_DIGITS = 3


class VisionDecision(StrEnum):
    SUGGESTED = "SUGGESTED"
    UNRECOGNISED = "UNRECOGNISED"


@dataclass(frozen=True)
class PromptBank:
    labels: tuple[str, ...]
    # Satir basina bir cumle, L2 normlu (N x 512)
    embeddings: np.ndarray


class VisionInput(BaseModel):
    image_embedding: list[float]


class TypeSuggestion(BaseModel):
    case_type_code: str
    confidence: float = Field(ge=0, le=1)


class VisionOutput(BaseModel):
    suggestions: list[TypeSuggestion]


def _type_scores(bank: PromptBank, embedding: list[float]) -> dict[str, float]:
    vector = np.asarray(embedding, dtype=np.float32)
    vector = vector / np.linalg.norm(vector)
    logits = LOGIT_SCALE * (bank.embeddings @ vector)
    weights = np.exp(logits - logits.max())
    probabilities = weights / weights.sum()
    scores: dict[str, float] = {}
    for label, probability in zip(bank.labels, probabilities, strict=True):
        scores[label] = scores.get(label, 0.0) + float(probability)
    return scores


def _suggest(bank: PromptBank, embedding: list[float]) -> VisionOutput:
    ranked = sorted(_type_scores(bank, embedding).items(), key=lambda item: -item[1])
    best_code, best_score = ranked[0]
    if best_code == NONE_LABEL or best_score < SUGGEST_FROM:
        return VisionOutput(suggestions=[])
    picked = [(code, score) for code, score in ranked if code != NONE_LABEL and score >= LIST_FROM]
    return VisionOutput(
        suggestions=[
            TypeSuggestion(case_type_code=code, confidence=round(score, CONFIDENCE_DIGITS))
            for code, score in picked[:MAX_SUGGESTIONS]
        ]
    )


class VisionAgent:
    name: ClassVar[str] = "vision"
    version: ClassVar[str] = "1.0"

    def __init__(self, bank: PromptBank) -> None:
        self._bank = bank

    def run(self, inp: VisionInput, ctx: AgentContext) -> AgentResult[VisionOutput]:
        output, latency = timed(lambda: _suggest(self._bank, inp.image_embedding))
        best = output.suggestions[0] if output.suggestions else None
        decision = VisionDecision.SUGGESTED if best else VisionDecision.UNRECOGNISED
        reason = (
            Reason(
                code="PHOTO_LOOKS_LIKE",
                message="Fotoğraf bu türe benziyor.",
                weight=best.confidence,
                evidence={"case_type_code": best.case_type_code},
            )
            if best
            else Reason(code="PHOTO_UNCLEAR", message="Fotoğraftan sorun türü anlaşılamadı.")
        )
        return AgentResult[VisionOutput](
            agent_name=self.name,
            decision=decision.value,
            confidence=best.confidence if best else None,
            reasons=[reason],
            output=output,
            model=VISION_MODEL,
            latency_ms=latency,
        )
