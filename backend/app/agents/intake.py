"""Intake Agent (K1, AGENTS.md 4.1): bildirimi analiz hattina hazirlar.

Metni normalize eder, aciliyet ve lokasyon ipuclarini cikarir, secilen lokasyonla metindeki
ipucunu karsilastirir. Karar vermez; Classification, Verification ve Priority'ye sinyal uretir.
"""

import re
from typing import ClassVar

from pydantic import BaseModel

from app.agents.base import RULES_MODEL, AgentContext, AgentResult, Reason, timed
from app.agents.text import normalize

# Normalize edilmis (ASCII) bicimde; cok kelimeli ifadeler once aranir
URGENCY_TERMS: tuple[str, ...] = (
    "elektrik carpti",
    "yanik kokusu",
    "gaz kokusu",
    "su basiyor",
    "kivilcim",
    "yangin",
    "duman",
    "patlama",
    "mahsur",
    "yaralandi",
    "acil",
)
# "b blok", "2. kat" / "2 kat", oda kodu "a101" / "a-101" / "z-12"
_BUILDING = re.compile(r"\b([a-z])\s*blok\b")
_FLOOR = re.compile(r"\b(\d{1,2})\s*kat\b")
_ROOM = re.compile(r"\b([a-z])-?(\d{1,4})\b")
# Anlamli metin icin en az 2 harfli bir kelime ve toplam 5 harf (ornek: "sabun yok")
_MIN_LETTERS = 5
_LETTER = re.compile(r"[a-z]")
_WORD = re.compile(r"\b[a-z]{2,}\b")
_PATH_SEPARATOR = "/"
_BUILDING_SEGMENT = 1


class LocationInfo(BaseModel):
    name: str
    # Materialized path: KMP/B/B-2/B-2-WCM (ikinci parca bina kodu)
    path: str


class IntakeInput(BaseModel):
    title: str
    description: str
    location: LocationInfo
    has_photo: bool


class IntakeOutput(BaseModel):
    normalized_text: str
    urgency_hints: list[str]
    location_hints: list[str]
    # None: metinde lokasyon ipucu yok; False: secilen yerle celisiyor
    location_consistency: bool | None
    is_meaningful: bool
    has_photo: bool


class IntakeAgent:
    name: ClassVar[str] = "intake"
    version: ClassVar[str] = "1.0"

    def run(self, inp: IntakeInput, ctx: AgentContext) -> AgentResult[IntakeOutput]:
        output, latency = timed(lambda: _analyze(inp))
        return AgentResult[IntakeOutput](
            agent_name=self.name,
            decision="PARSED" if output.is_meaningful else "TOO_SHORT",
            confidence=None,
            reasons=_reasons(output),
            output=output,
            model=RULES_MODEL,
            latency_ms=latency,
        )


def _analyze(inp: IntakeInput) -> IntakeOutput:
    text = _combined(inp)
    return IntakeOutput(
        normalized_text=text,
        urgency_hints=[term for term in URGENCY_TERMS if re.search(rf"\b{term}", text)],
        location_hints=_location_hints(text),
        location_consistency=_consistency(text, inp.location),
        is_meaningful=_is_meaningful(text),
        has_photo=inp.has_photo,
    )


def _location_hints(text: str) -> list[str]:
    buildings = [f"{m.group(1)} blok" for m in _BUILDING.finditer(text)]
    floors = [f"{m.group(1)}. kat" for m in _FLOOR.finditer(text)]
    return buildings + floors


def _consistency(text: str, location: LocationInfo) -> bool | None:
    """Metindeki bina harfi ya da oda kodu secilen lokasyonun yolunda var mi?"""
    segments = normalize(location.path.replace(_PATH_SEPARATOR, " ")).split()
    building = segments[_BUILDING_SEGMENT] if len(segments) > _BUILDING_SEGMENT else ""
    compact_path = {segment.replace("-", "") for segment in segments}
    checks = [m.group(1) == building for m in _BUILDING.finditer(text)]
    checks += [f"{m.group(1)}{m.group(2)}" in compact_path for m in _ROOM.finditer(text)]
    if not checks:
        return None
    return all(checks)


def _combined(inp: IntakeInput) -> str:
    """Baslik + aciklama. Bos birakilan baslik aciklamanin basindan uretilir; o zaman ayni metin iki
    kez sayilmaz (anlamsiz kisa metin "anlasilir" gorunurdu)."""
    title, description = normalize(inp.title), normalize(inp.description)
    if description.startswith(title):
        return description
    return f"{title} {description}"


def _is_meaningful(text: str) -> bool:
    return len(_LETTER.findall(text)) >= _MIN_LETTERS and bool(_WORD.search(text))


def _reasons(output: IntakeOutput) -> list[Reason]:
    reasons: list[Reason] = []
    if output.urgency_hints:
        reasons.append(
            Reason(
                code="URGENCY_TERMS",
                message="Metinde aciliyet bildiren ifadeler var: "
                + ", ".join(output.urgency_hints),
                evidence={"terms": output.urgency_hints},
            )
        )
    if output.location_consistency is False:
        reasons.append(
            Reason(
                code="LOCATION_MISMATCH",
                message="Metindeki yer bilgisi seçilen konumla uyuşmuyor.",
                evidence={"hints": output.location_hints},
            )
        )
    if not output.is_meaningful:
        reasons.append(
            Reason(code="TEXT_TOO_SHORT", message="Açıklama anlaşılır değil ya da çok kısa.")
        )
    return reasons
