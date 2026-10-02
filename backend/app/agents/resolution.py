"""Resolution Agent (K1, docs/AGENTS.md 4.9): personel "tamamlandi" dediginde is bitmis mi.

Kanit: tamamlama notu, personelin ekledigi fotograf ve calisma suresi. Fotograf en guclu kanittir;
kisa not ya da supheli kisa sureyi telafi eder. Notta "yapilamadi" gibi bir ifade varsa is
bitmemistir (fotograf olsa da). Fotografin icerigi incelenmez (MVP disi). Karari servis uygular.
"""

import re
from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, Field

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.agents.text import normalize

# "tamam", "bitti" gibi notlar ne yapildigini anlatmaz
MIN_NOTE_LENGTH = 10
# Bundan kisa surede bitirilen is supheli ("baslat" + hemen "tamamla"). Varsayim: gercek veriyle
# ayarlanacak; uzun suren onarim turleri ayrica
DEFAULT_MIN_WORK_MINUTES = 2
MIN_WORK_MINUTES: dict[str, int] = {
    "ELEVATOR_FAILURE": 10,
    "ELECTRICAL_FAILURE": 5,
    "AIR_CONDITIONER_FAILURE": 5,
}
# Normalize edilmis notta tam kelime olarak aranir (ASCII, kucuk harf)
NOT_DONE_PHRASES = (
    "yapilamadi",
    "yapamadim",
    "yapamadik",
    "giderilemedi",
    "onarilamadi",
    "cozulemedi",
    "tamamlanamadi",
    "parca yok",
    "malzeme yok",
    "parca bekleniyor",
    "tedarik",
)
_NOT_DONE = re.compile(r"\b(" + "|".join(re.escape(p) for p in NOT_DONE_PHRASES) + r")\b")


class ResolutionDecision(StrEnum):
    RESOLVED = "RESOLVED"
    NEEDS_MORE_EVIDENCE = "NEEDS_MORE_EVIDENCE"
    REOPEN = "REOPEN"


class ResolutionInput(BaseModel):
    completion_note: str | None
    # Bu gorevin personelinin bildirime ekledigi kanit fotografi
    has_evidence_photo: bool
    # Baslatma -> tamamlama
    work_minutes: float = Field(ge=0)
    # Manager turu belirlemeden atadiysa bos
    case_type_code: str | None


class ResolutionOutput(BaseModel):
    decision: ResolutionDecision
    # Personele / manager'a gosterilen kisa aciklama (eksik kanit ya da yapilamama nedeni)
    message: str


def _not_done(note: str) -> Reason | None:
    found = _NOT_DONE.search(normalize(note))
    if found is None:
        return None
    return Reason(
        code="NOT_DONE",
        message="Notta işin yapılamadığı yazıyor; bildirim yeniden açılır ve müdüre iletilir.",
        evidence={"phrase": found.group(1)},
    )


def _signals(inp: ResolutionInput, note: str) -> list[Reason]:
    minimum = MIN_WORK_MINUTES.get(inp.case_type_code or "", DEFAULT_MIN_WORK_MINUTES)
    photo = [Reason(code="EVIDENCE_PHOTO", message="Kanıt fotoğrafı eklenmiş.")]
    note_reason = (
        Reason(code="NOTE_OK", message="Yapılan iş açıklanmış.")
        if len(note) >= MIN_NOTE_LENGTH
        else Reason(
            code="NOTE_TOO_SHORT",
            message="Ne yapıldığını birkaç kelimeyle yazın ya da fotoğraf ekleyin.",
            evidence={"length": len(note), "min_length": MIN_NOTE_LENGTH},
        )
    )
    duration = (
        Reason(code="DURATION_OK", message="Çalışma süresi makul.")
        if inp.work_minutes >= minimum
        else Reason(
            code="TOO_QUICK",
            message=f"İş {minimum} dakikadan kısa sürede bitirilmiş; fotoğraf ekleyin.",
            evidence={"work_minutes": round(inp.work_minutes, 1), "min_minutes": minimum},
        )
    )
    return [*(photo if inp.has_evidence_photo else []), note_reason, duration]


_MISSING = frozenset({"NOTE_TOO_SHORT", "TOO_QUICK"})


def _evaluate(inp: ResolutionInput) -> tuple[ResolutionOutput, list[Reason]]:
    note = (inp.completion_note or "").strip()
    not_done = _not_done(note)
    if not_done is not None:
        return ResolutionOutput(decision=ResolutionDecision.REOPEN, message=not_done.message), [
            not_done
        ]
    reasons = _signals(inp, note)
    missing = [r for r in reasons if r.code in _MISSING]
    if missing and not inp.has_evidence_photo:
        message = " ".join(r.message for r in missing)
        return ResolutionOutput(decision=ResolutionDecision.NEEDS_MORE_EVIDENCE, message=message), (
            reasons
        )
    output = ResolutionOutput(decision=ResolutionDecision.RESOLVED, message="İş tamamlanmış.")
    return output, reasons


class ResolutionAgent:
    name: ClassVar[str] = "resolution"
    version: ClassVar[str] = "1.0"

    def run(self, inp: ResolutionInput, ctx: AgentContext) -> AgentResult[ResolutionOutput]:
        (output, reasons), latency = timed(lambda: _evaluate(inp))
        return AgentResult[ResolutionOutput](
            agent_name=self.name,
            decision=output.decision.value,
            confidence=None,
            reasons=reasons,
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )
