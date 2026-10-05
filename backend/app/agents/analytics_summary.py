"""Analytics Summary Agent (K1 sablon + opsiyonel K3, docs/AGENTS.md 4.10): yonetim ozeti.

KPI'lari backend hesaplar (docs/ANALYTICS.md bolum 5); agent SQL uretmez, DB'ye dokunmaz.
- Varsayilan: sablon tabanli metin. Her cumle bir veri alanina baglidir; uydurma sayi imkansizdir.
- Opsiyonel yerel LLM (Ollama) yalniz metni akicilastirir. Ciktidaki her sayi girdide ya da sablon
  metninde olmali; neden-sonuc ifadesi ("cunku", "nedeniyle") yasak. Aksi halde LLM ciktisi atilir,
  sablon metin doner. LLM'e ulasilamazsa da sablon doner.
"""

import json
import re
from datetime import date
from enum import StrEnum
from typing import ClassVar, Protocol

from pydantic import BaseModel, ConfigDict, Field

from app.agents.base import AgentContext, AgentResult, Reason, timed
from app.agents.text import normalize
from app.models.enums import CaseCategory

TEMPLATE_MODEL = "template-nlg@1.0"
MINUTES_PER_HOUR = 60
# Ozette en fazla bu kadar tekrarlayan sorun anilir
MAX_RECURRING = 3
# Sayilar: tam sayi ya da virgullu ondalik ("82", "4,5"). Nokta tarih ayiricidir (19.09.2026)
_NUMBER = re.compile(r"\d+(?:,\d+)?")
# Normalize metinde aranir (ASCII). Korelasyon nedensellik gibi sunulmaz (AGENTS.md 4.10)
CAUSAL_WORDS = ("cunku", "nedeniyle", "yuzunden", "sebebiyle", "dolayi", "neden oldu")
_CAUSAL = re.compile(r"\b(" + "|".join(CAUSAL_WORDS) + r")\b")

CATEGORY_LABELS: dict[CaseCategory, str] = {
    CaseCategory.CLEANING: "Temizlik",
    CaseCategory.CONSUMABLE: "Sarf malzemesi",
    CaseCategory.TECHNICAL: "Teknik",
    CaseCategory.IT: "Bilgi teknolojileri",
    CaseCategory.INFRASTRUCTURE: "Altyapı",
    CaseCategory.SECURITY: "Güvenlik",
    CaseCategory.FOOD_SERVICE: "Yemekhane",
    CaseCategory.OTHER: "Diğer",
}


class Period(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    start: date = Field(alias="from")
    end: date = Field(alias="to")


class CategoryCount(BaseModel):
    code: CaseCategory
    count: int


class LocationCount(BaseModel):
    path: str
    count: int


class RecurringProblem(BaseModel):
    location: str
    type: str
    # Turun okunur adi (KPI servisi doldurur); yoksa kod yazilir
    type_name: str | None = None
    count: int


class SlowDepartment(BaseModel):
    name: str
    median_resolution_min: int


class SummaryInput(BaseModel):
    """docs/ANALYTICS.md bolum 5; bilinmeyen alan bos birakilir, cumlesi yazilmaz."""

    period: Period
    total_cases: int
    previous_period_change_pct: int | None = None
    top_category: CategoryCount | None = None
    highest_problem_location: LocationCount | None = None
    sla_compliance_pct: int | None = None
    sla_breaches: int | None = None
    recurring_problems: list[RecurringProblem] = Field(default_factory=list)
    slowest_department: SlowDepartment | None = None
    automation_rate_pct: int | None = None


class SummarySource(StrEnum):
    TEMPLATE = "TEMPLATE"
    LLM = "LLM"


class Sentence(BaseModel):
    # Cumlenin dayandigi girdi alani (izlenebilirlik)
    field: str
    text: str


class SummaryOutput(BaseModel):
    text: str
    source: SummarySource
    sentences: list[Sentence]


class PolisherUnavailableError(Exception):
    """Yerel LLM'e ulasilamadi ya da gecersiz yanit verdi; sablon metin kullanilir."""


class TextPolisher(Protocol):
    def polish(self, text: str, data: dict[str, object]) -> str: ...


# --- Sablon --------------------------------------------------------------------------------


def _day(value: date) -> str:
    return value.strftime("%d.%m.%Y")


def _duration(minutes: int) -> str:
    hours, rest = divmod(minutes, MINUTES_PER_HOUR)
    if hours == 0:
        return f"{rest} dakika"
    return f"{hours} saat {rest} dakika" if rest else f"{hours} saat"


def _total(inp: SummaryInput) -> str:
    dates = f"{_day(inp.period.start)} - {_day(inp.period.end)}"
    period = f"{dates} döneminde {inp.total_cases} bildirim açıldı"
    change = inp.previous_period_change_pct
    if change is None:
        return f"{period}."
    if change == 0:
        return f"{period}; önceki dönemle aynı."
    direction = "artış" if change > 0 else "azalış"
    return f"{period}; önceki döneme göre %{abs(change)} {direction}."


def _sentences(inp: SummaryInput) -> list[Sentence]:
    found: list[tuple[str, str | None]] = [("total_cases", _total(inp))]
    if inp.top_category:
        label = CATEGORY_LABELS[inp.top_category.code]
        found.append(
            ("top_category", f"En çok bildirim {label} kategorisinde ({inp.top_category.count}).")
        )
    if inp.highest_problem_location:
        place = inp.highest_problem_location
        found.append(
            (
                "highest_problem_location",
                f"En çok sorun bildirilen yer {place.path} ({place.count} bildirim).",
            )
        )
    found.append(("sla_compliance_pct", _sla(inp)))
    found.append(("recurring_problems", _recurring(inp.recurring_problems)))
    if inp.slowest_department:
        slow = inp.slowest_department
        found.append(
            (
                "slowest_department",
                f"En uzun çözüm süresi {slow.name} biriminde "
                f"(tipik süre {_duration(slow.median_resolution_min)}).",
            )
        )
    if inp.automation_rate_pct is not None:
        found.append(
            (
                "automation_rate_pct",
                "Yapay zekânın insan müdahalesi olmadan yönlendirdiği bildirim oranı: "
                f"%{inp.automation_rate_pct}.",
            )
        )
    return [Sentence(field=field, text=text) for field, text in found if text]


def _sla(inp: SummaryInput) -> str | None:
    if inp.sla_compliance_pct is None:
        return None
    sentence = f"Süre hedeflerine uyum %{inp.sla_compliance_pct}"
    if inp.sla_breaches:
        return f"{sentence}; {inp.sla_breaches} bildirimde süre aşıldı."
    return f"{sentence}."


def _recurring(problems: list[RecurringProblem]) -> str | None:
    if not problems:
        return None
    parts = [
        f"{p.location} konumunda {p.type_name or p.type} sorunu {p.count} kez"
        for p in problems[:MAX_RECURRING]
    ]
    return f"Tekrarlayan sorunlar: {'; '.join(parts)}. Kalıcı çözüm değerlendirilebilir."


# --- LLM korumasi --------------------------------------------------------------------------


def _numbers(text: str) -> set[float]:
    return {float(n.replace(",", ".")) for n in _NUMBER.findall(text)}


def check_polished(polished: str, reference: str) -> str | None:
    """LLM metni kabul edilebilir mi; degilse red gerekcesi kodu."""
    if not _numbers(polished) <= _numbers(reference):
        return "LLM_REJECTED_NUMBERS"
    if _CAUSAL.search(normalize(polished)):
        return "LLM_REJECTED_CAUSAL"
    return None


_REJECTION_MESSAGES = {
    "LLM_REJECTED_NUMBERS": "Yerel model girdide olmayan bir sayı yazdı; şablon metin kullanıldı.",
    "LLM_REJECTED_CAUSAL": "Yerel model neden-sonuç ifadesi kurdu; şablon metin kullanıldı.",
    "LLM_UNAVAILABLE": "Yerel modele ulaşılamadı; şablon metin kullanıldı.",
}


class AnalyticsSummaryAgent:
    name: ClassVar[str] = "analytics_summary"
    version: ClassVar[str] = "1.0"

    def __init__(self, polisher: TextPolisher | None = None) -> None:
        # None: LLM_PROVIDER=none (varsayilan); yalniz sablon
        self._polisher = polisher

    def run(self, inp: SummaryInput, ctx: AgentContext) -> AgentResult[SummaryOutput]:
        (output, reasons), latency = timed(lambda: self._summarize(inp))
        return AgentResult[SummaryOutput](
            agent_name=self.name,
            decision=output.source.value,
            confidence=None,
            reasons=reasons,
            output=output,
            model=TEMPLATE_MODEL,
            latency_ms=latency,
        )

    def _summarize(self, inp: SummaryInput) -> tuple[SummaryOutput, list[Reason]]:
        sentences = _sentences(inp)
        text = " ".join(s.text for s in sentences)
        template = SummaryOutput(text=text, source=SummarySource.TEMPLATE, sentences=sentences)
        used = Reason(code="TEMPLATE", message="Her cümle bir KPI alanından üretildi.")
        if self._polisher is None:
            return template, [used]
        data = inp.model_dump(mode="json", by_alias=True)
        try:
            polished = self._polisher.polish(text, data)
        except PolisherUnavailableError:
            return template, [used, _rejected("LLM_UNAVAILABLE")]
        rejection = check_polished(polished, f"{text} {json.dumps(data)}")
        if rejection is not None:
            return template, [used, _rejected(rejection)]
        llm = SummaryOutput(text=polished, source=SummarySource.LLM, sentences=sentences)
        return llm, [
            Reason(code="LLM_POLISHED", message="Şablon metin yerel modelle akıcılaştırıldı.")
        ]


def _rejected(code: str) -> Reason:
    return Reason(code=code, message=_REJECTION_MESSAGES[code])
