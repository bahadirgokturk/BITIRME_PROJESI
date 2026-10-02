"""Classification Agent (K2 + K1, docs/AGENTS.md 4.2): bildirimin turunu belirler.

1. Model varsa (ai/ ile egitilen TF-IDF + LR) olasiliklar; yoksa anahtar kelime puanlamasi
   (rules@1.0).
2. Yalniz kurumun aktif turleri arasindan secilir (girdideki case_types).
3. Guvenlik kurali: kivilcim, yangin gibi ifadeler varsa model ne derse desin ilgili guvenlik turu.
Karar vermez; guven skoru dusukse insan incelemesine gonderme karari Supervisor'indir.
"""

import re
from dataclasses import dataclass
from typing import Any, ClassVar

from pydantic import BaseModel

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.agents.text import normalize
from app.models.enums import CaseCategory

# Normalize edilmis bicimde; ilk eslesen kural gecerli. Hedef turler L3 (insan karari) turlerdir
SAFETY_RULES: tuple[tuple[str, str], ...] = (
    ("kivilcim", "ELECTRICAL_FAILURE"),
    ("elektrik carpti", "ELECTRICAL_FAILURE"),
    ("yanik kokusu", "ELECTRICAL_FAILURE"),
    ("yangin", "SECURITY_INCIDENT"),
    ("duman", "SECURITY_INCIDENT"),
    ("patlama", "SECURITY_INCIDENT"),
    ("gaz kokusu", "SECURITY_INCIDENT"),
    ("su basiyor", "WATER_LEAK"),
)
_SAFETY_CODES = frozenset(code for _, code in SAFETY_RULES)
# Gerekcede gosterilen aday sayisi (manager ikinci/ucuncu tahmini de gorur)
TOP_K = 3
# Hicbir tur eslesmezse: insan inceler (docs/DEPARTMENTS.md)
FALLBACK_CODE = "OTHER"
ML_MODEL_PREFIX = "tfidf-logreg"


@dataclass(frozen=True)
class LoadedClassifier:
    """Yuklenmis sklearn pipeline'i (predict_proba + classes_) ve egitim surumu."""

    pipeline: Any
    version: str


class CaseTypeInfo(BaseModel):
    code: str
    category: CaseCategory
    keywords: list[str]


class ClassificationInput(BaseModel):
    title: str
    description: str
    case_types: list[CaseTypeInfo]


class Candidate(BaseModel):
    code: str
    probability: float


class ClassificationOutput(BaseModel):
    case_type_code: str
    category: CaseCategory
    top_k: list[Candidate]
    # Secilen turun metinde gecen anahtar kelimeleri (aciklama icin)
    matched_keywords: list[str]
    safety_override: bool


@dataclass(frozen=True)
class _Decision:
    output: ClassificationOutput
    confidence: float
    reasons: list[Reason]
    model: str


class ClassificationAgent:
    name: ClassVar[str] = "classification"
    version: ClassVar[str] = "1.0"

    def __init__(self, model: LoadedClassifier | None) -> None:
        self._model = model

    def run(self, inp: ClassificationInput, ctx: AgentContext) -> AgentResult[ClassificationOutput]:
        decision, latency = timed(lambda: self._classify(inp))
        return AgentResult[ClassificationOutput](
            agent_name=self.name,
            decision=decision.output.case_type_code,
            confidence=decision.confidence,
            reasons=decision.reasons,
            output=decision.output,
            model=decision.model,
            latency_ms=latency,
        )

    def _classify(self, inp: ClassificationInput) -> _Decision:
        raw = f"{inp.title} {inp.description}".strip()
        text = normalize(raw)
        known = {case_type.code: case_type for case_type in inp.case_types}
        if self._model is None:
            candidates, model = _rule_candidates(text, inp.case_types), RULES_MODEL
        else:
            candidates = _model_candidates(self._model, raw, known)
            model = f"{ML_MODEL_PREFIX}@{self._model.version}"
        chosen, override_reason = _apply_safety(text, candidates)
        reasons = _base_reasons(candidates, from_model=self._model is not None)
        if override_reason:
            reasons.append(override_reason)
        case_type = known.get(chosen.code)
        output = ClassificationOutput(
            case_type_code=chosen.code,
            category=case_type.category if case_type else CaseCategory.OTHER,
            top_k=candidates[:TOP_K],
            matched_keywords=_matched(text, case_type.keywords) if case_type else [],
            safety_override=override_reason is not None,
        )
        return _Decision(output=output, confidence=chosen.probability, reasons=reasons, model=model)


def _model_candidates(
    model: LoadedClassifier, raw: str, known: dict[str, CaseTypeInfo]
) -> list[Candidate]:
    # Pipeline metni kendi icinde normalize eder (egitimdeki ayni fonksiyon)
    probabilities = model.pipeline.predict_proba([raw])[0]
    pairs = zip(model.pipeline.classes_, probabilities, strict=True)
    candidates = [Candidate(code=str(c), probability=float(p)) for c, p in pairs if str(c) in known]
    return sorted(candidates, key=lambda c: c.probability, reverse=True) or [_fallback()]


def _rule_candidates(text: str, case_types: list[CaseTypeInfo]) -> list[Candidate]:
    """Eslesen anahtar kelime sayisi; olasilik yerine toplam eslesmedeki pay."""
    scores = {ct.code: len(_matched(text, ct.keywords)) for ct in case_types}
    total = sum(scores.values())
    if total == 0:
        return [_fallback()]
    candidates = [Candidate(code=code, probability=n / total) for code, n in scores.items() if n]
    return sorted(candidates, key=lambda c: c.probability, reverse=True)


def _fallback() -> Candidate:
    return Candidate(code=FALLBACK_CODE, probability=0.0)


def _matched(text: str, keywords: list[str]) -> list[str]:
    # Kelime basindan eslesme: "sabunluk" -> "sabunlukta" da sayilir (Turkce ekler)
    padded = f" {text}"
    return [keyword for keyword in keywords if f" {normalize(keyword)}" in padded]


def _apply_safety(text: str, candidates: list[Candidate]) -> tuple[Candidate, Reason | None]:
    chosen = candidates[0]
    rule = next(((t, c) for t, c in SAFETY_RULES if re.search(rf"\b{t}", text)), None)
    if rule is None or chosen.code in _SAFETY_CODES:
        return chosen, None
    term, code = rule
    probability = next((c.probability for c in candidates if c.code == code), 0.0)
    reason = Reason(
        code="SAFETY_RULE",
        message=f"Metinde güvenlik açısından kritik ifade var: {term}",
        evidence={"term": term, "model_choice": chosen.code},
    )
    return Candidate(code=code, probability=probability), reason


def _base_reasons(candidates: list[Candidate], *, from_model: bool) -> list[Reason]:
    best = candidates[0]
    if not from_model and best.probability == 0.0:
        return [Reason(code="NO_KEYWORD_MATCH", message="Metinde bilinen bir anahtar kelime yok.")]
    top = [c.model_dump() for c in candidates[:TOP_K]]
    if from_model:
        message = f"Model tahmini: {best.code} (%{round(best.probability * 100)})"
        return [Reason(code="MODEL_PREDICTION", message=message, evidence={"top_k": top})]
    message = f"Anahtar kelime eşleşmesi: {best.code}"
    return [Reason(code="RULE_MATCH", message=message, evidence={"top_k": top})]
