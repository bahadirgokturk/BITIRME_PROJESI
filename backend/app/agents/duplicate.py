"""Duplicate Agent (K2 + K1, docs/AGENTS.md 4.3): yeni bildirim acik bir bildirimle ayni sorun mu.

Skor = 0.45 metin + 0.25 tur + 0.20 konum + 0.10 zaman. Adaylari (ayni bina, son 24 saat, acik)
servis secer; agent DB'ye dokunmaz. Karar esikleri Supervisor ile ortaktir: >= 0.80 birlestir,
0.60-0.80 manager incelesin, alti yeni bildirim.
"""

import math
from datetime import datetime
from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer

from app.agents.base import AgentContext, AgentResult, Reason, timed
from app.agents.text import normalize

DUPLICATE_MODEL = "char-tf-cosine@1.0"
# Bilesen agirliklari (AGENTS.md 4.3); toplam 1
TEXT_WEIGHT = 0.45
TYPE_WEIGHT = 0.25
LOCATION_WEIGHT = 0.20
TIME_WEIGHT = 0.10
# Konum yakinligi: ayni yer > ayni kat > ayni bina
SAME_FLOOR_SCORE = 0.6
SAME_BUILDING_SCORE = 0.3
# Zaman sonumu exp(-dakika / tau): hizli degisen sorunlarda (su kacagi) eski bildirim daha cabuk
# "baska olay" sayilir
DEFAULT_TAU_MINUTES = 120
TAU_MINUTES: dict[str, int] = {"WATER_LEAK": 60}
SECONDS_PER_MINUTE = 60
DUPLICATE_FROM = 0.80
POSSIBLE_DUPLICATE_FROM = 0.60
# Manager'a gosterilen en benzer bildirim sayisi
MAX_SIMILAR_CASES = 3
SCORE_DIGITS = 3
# Karakter n-gram ekli bicimlere dayanikli ("sabunluk", "sabunu"). IDF kullanilmaz: aday kumesi
# 2-10 metindir; IDF ortak kelimeleri (tam da benzerligi gosterenleri) cezalandirir
NGRAM_RANGE = (3, 5)
# Materialized path KMP/A/A-1/A-1-WCE: 1. parca bina, 2. parca kat (yalniz kattan derin yerlerde)
BUILDING_SEGMENT = 1
FLOOR_SEGMENT = 2
PATH_SEPARATOR = "/"


class DuplicateDecision(StrEnum):
    DUPLICATE = "DUPLICATE"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
    NEW_CASE = "NEW_CASE"


class DuplicateCandidate(BaseModel):
    case_id: int
    text: str
    case_type_code: str
    location_id: int
    location_path: str
    created_at: datetime
    # Bu bildirime daha once baglanmis bildirim sayisi
    duplicate_count: int = Field(ge=0)


class DuplicateInput(BaseModel):
    text: str
    # Classification karari
    case_type_code: str
    location_id: int
    location_path: str
    reported_at: datetime
    candidates: list[DuplicateCandidate]


class SimilarCase(BaseModel):
    case_id: int
    score: float
    # text, type, location, time (her biri 0..1)
    components: dict[str, float]


class DuplicateOutput(BaseModel):
    duplicate_probability: float = Field(ge=0, le=1)
    # Esik (0.60) ustundeki en benzer bildirim; altindaysa bos
    possible_parent_case_id: int | None
    # Ayni sorunu bildiren diger kisiler (Verification ve Priority sinyali)
    duplicate_count: int = Field(ge=0)
    similar_cases: list[SimilarCase]


def _text_similarities(text: str, others: list[str]) -> list[float]:
    texts = [normalize(t) for t in [text, *others]]
    if not texts[0] or not others:
        return [0.0] * len(others)
    vectorizer = TfidfVectorizer(
        analyzer="char_wb", ngram_range=NGRAM_RANGE, use_idf=False, sublinear_tf=True
    )
    # Satirlar L2 normlu: ic carpim = kosinus
    matrix = vectorizer.fit_transform(texts)
    return [float(v) for v in (matrix[1:] @ matrix[0].T).toarray().ravel()]


def _segment(path: str, index: int) -> str | None:
    segments = path.split(PATH_SEPARATOR)
    # Son parca yerin kendisidir; kat ancak yer kattan derindeyse vardir
    return segments[index] if len(segments) > index + 1 else None


def _location_score(inp: DuplicateInput, candidate: DuplicateCandidate) -> float:
    if candidate.location_id == inp.location_id:
        return 1.0
    floor = _segment(inp.location_path, FLOOR_SEGMENT)
    building = _segment(inp.location_path, BUILDING_SEGMENT)
    if floor is not None and floor == _segment(candidate.location_path, FLOOR_SEGMENT):
        return SAME_FLOOR_SCORE
    if building is not None and building == _segment(candidate.location_path, BUILDING_SEGMENT):
        return SAME_BUILDING_SCORE
    return 0.0


def _time_decay(inp: DuplicateInput, candidate: DuplicateCandidate) -> float:
    minutes = max((inp.reported_at - candidate.created_at).total_seconds(), 0) / SECONDS_PER_MINUTE
    tau = TAU_MINUTES.get(inp.case_type_code, DEFAULT_TAU_MINUTES)
    return math.exp(-minutes / tau)


def _similar(inp: DuplicateInput, candidate: DuplicateCandidate, text: float) -> SimilarCase:
    components = {
        "text": text,
        "type": 1.0 if candidate.case_type_code == inp.case_type_code else 0.0,
        "location": _location_score(inp, candidate),
        "time": _time_decay(inp, candidate),
    }
    score = (
        TEXT_WEIGHT * components["text"]
        + TYPE_WEIGHT * components["type"]
        + LOCATION_WEIGHT * components["location"]
        + TIME_WEIGHT * components["time"]
    )
    return SimilarCase(
        case_id=candidate.case_id,
        score=round(min(score, 1.0), SCORE_DIGITS),
        components={k: round(v, SCORE_DIGITS) for k, v in components.items()},
    )


def _check(inp: DuplicateInput) -> DuplicateOutput:
    texts = _text_similarities(inp.text, [c.text for c in inp.candidates])
    ranked = sorted(
        (_similar(inp, c, t) for c, t in zip(inp.candidates, texts, strict=True)),
        key=lambda s: (-s.score, s.case_id),
    )
    merged_into = {c.case_id: c.duplicate_count for c in inp.candidates}
    similar = [s for s in ranked if s.score >= POSSIBLE_DUPLICATE_FROM]
    best = ranked[0] if ranked else None
    return DuplicateOutput(
        duplicate_probability=best.score if best else 0.0,
        possible_parent_case_id=similar[0].case_id if similar else None,
        # Her benzer bildirim: kendisi + ona daha once baglananlar
        duplicate_count=sum(1 + merged_into[s.case_id] for s in similar),
        similar_cases=ranked[:MAX_SIMILAR_CASES],
    )


def _decision(probability: float) -> DuplicateDecision:
    if probability >= DUPLICATE_FROM:
        return DuplicateDecision.DUPLICATE
    if probability >= POSSIBLE_DUPLICATE_FROM:
        return DuplicateDecision.POSSIBLE_DUPLICATE
    return DuplicateDecision.NEW_CASE


_MESSAGES: dict[DuplicateDecision, tuple[str, str]] = {
    DuplicateDecision.DUPLICATE: ("DUPLICATE_OF", "Aynı sorun bu yerde zaten bildirilmiş."),
    DuplicateDecision.POSSIBLE_DUPLICATE: (
        "POSSIBLE_DUPLICATE",
        "Benzer bir bildirim var; aynı sorun olabilir.",
    ),
    DuplicateDecision.NEW_CASE: ("NO_SIMILAR_CASE", "Yakında benzer açık bildirim yok."),
}


class DuplicateAgent:
    name: ClassVar[str] = "duplicate"
    version: ClassVar[str] = "1.0"

    def run(self, inp: DuplicateInput, ctx: AgentContext) -> AgentResult[DuplicateOutput]:
        output, latency = timed(lambda: _check(inp))
        decision = _decision(output.duplicate_probability)
        code, message = _MESSAGES[decision]
        best = output.similar_cases[0] if output.similar_cases else None
        reason = Reason(
            code=code,
            message=message,
            weight=output.duplicate_probability,
            evidence=best.model_dump() if best else {},
        )
        return AgentResult[DuplicateOutput](
            agent_name=self.name,
            decision=decision.value,
            confidence=output.duplicate_probability,
            reasons=[reason],
            output=output,
            model=DUPLICATE_MODEL,
            latency_ms=latency,
        )
