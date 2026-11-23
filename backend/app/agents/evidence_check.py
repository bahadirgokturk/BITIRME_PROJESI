"""Evidence Check Agent (K1, docs/AGENTS.md 4.13): personelin kanit fotografi, bildirim
fotografindaki yerden mi cekilmis.

Personel isi bitirince fotograf ekler; Resolution Agent fotografi en guclu kanit sayar. Ama fotograf
baska bir yerden (ya da eski bir kareden) olabilir. Goruntu modeli (CLIP) iki fotografin vektorleri
arasindaki kosinus benzerligine bakar: bildirimin fotograflarindan en benzeri esigin altindaysa
"farkli yer" denir. Sorunun giderilip giderilmedigi fotograftan anlasilmaz (dolu ve bos sabunluk
CLIP'e ayni gorunur); agent yalniz yeri kontrol eder.
"""

from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed

# Bu benzerligin altindaki kanit "farkli yer" sayilir. Kalibrasyon (23.11.2026, 12 kampus fotografi,
# 66 cift): ayni yerden cekilen 8 ciftin en dusugu 0.861, farkli yer ciftlerinin ortancasi 0.775 ve
# en yuksegi 0.865 (tuvaletler birbirine cok benzer). 0.80'de ayni yer ciftlerinin hicbiri yanlis
# isaretlenmedi, farkli yer ciftlerinin 43/58'i yakalandi. Temkinli secildi: personeli haksiz yere
# geri cevirmek, kacan bir sahte fotograftan daha pahalidir. Ayni fotograflarla ayarlandigi icin
# iyimserdir; yeni fotograflarla yeniden olculur.
SAME_PLACE_FROM = 0.80
SCORE_DIGITS = 3


class EvidenceCheckDecision(StrEnum):
    SAME_PLACE = "SAME_PLACE"
    DIFFERENT_PLACE = "DIFFERENT_PLACE"
    # Bildirimde fotograf yok: karsilastirilacak bir sey yok
    NO_REFERENCE = "NO_REFERENCE"


class EvidenceCheckInput(BaseModel):
    # Kanit fotografinin bildirimdeki her fotografla kosinus benzerligi
    similarities: list[float]


class EvidenceCheckOutput(BaseModel):
    best_similarity: float | None


_MESSAGES: dict[EvidenceCheckDecision, str] = {
    EvidenceCheckDecision.SAME_PLACE: "Kanıt fotoğrafı bildirimdeki yerle uyumlu.",
    EvidenceCheckDecision.DIFFERENT_PLACE: (
        "Kanıt fotoğrafı bildirimdeki yere benzemiyor; işin yapıldığı yerden fotoğraf ekleyin."
    ),
    EvidenceCheckDecision.NO_REFERENCE: "Bildirimde fotoğraf yok; yer karşılaştırılamadı.",
}


def _decide(inp: EvidenceCheckInput) -> tuple[EvidenceCheckDecision, float | None]:
    if not inp.similarities:
        return EvidenceCheckDecision.NO_REFERENCE, None
    best = max(inp.similarities)
    if best >= SAME_PLACE_FROM:
        return EvidenceCheckDecision.SAME_PLACE, best
    return EvidenceCheckDecision.DIFFERENT_PLACE, best


class EvidenceCheckAgent:
    name: ClassVar[str] = "evidence_check"
    version: ClassVar[str] = "1.0"

    def run(self, inp: EvidenceCheckInput, ctx: AgentContext) -> AgentResult[EvidenceCheckOutput]:
        (decision, best), latency = timed(lambda: _decide(inp))
        score = round(best, SCORE_DIGITS) if best is not None else None
        evidence = {} if score is None else {"similarity": score, "threshold": SAME_PLACE_FROM}
        return AgentResult[EvidenceCheckOutput](
            agent_name=self.name,
            decision=decision.value,
            confidence=score,
            reasons=[Reason(code=decision.value, message=_MESSAGES[decision], evidence=evidence)],
            output=EvidenceCheckOutput(best_similarity=score),
            model=RULES_MODEL,
            latency_ms=latency,
        )
