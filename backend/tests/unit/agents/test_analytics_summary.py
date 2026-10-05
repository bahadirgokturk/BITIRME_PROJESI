"""Analytics Summary Agent (AGENTS.md 4.10): KPI JSON'undan yonetim ozeti.

Varsayilan sablon: her cumle bir veri alanina baglidir, uydurma sayi imkansizdir. Opsiyonel yerel
LLM yalniz metni akicilastirir; ciktisinda girdide olmayan sayi ya da neden-sonuc ifadesi varsa
atilir.
"""

from datetime import UTC, date, datetime

import pytest

from app.agents.analytics_summary import (
    TEMPLATE_MODEL,
    AnalyticsSummaryAgent,
    PolisherUnavailableError,
    SummaryInput,
    SummarySource,
    check_polished,
)
from app.agents.base import AgentContext

CTX = AgentContext(now=datetime(2026, 9, 26, 12, 0, tzinfo=UTC))
KPI = SummaryInput.model_validate(
    {
        "period": {"from": date(2026, 9, 19), "to": date(2026, 9, 26)},
        "total_cases": 186,
        "previous_period_change_pct": 14,
        "top_category": {"code": "CLEANING", "count": 71},
        "highest_problem_location": {"path": "B Blok", "count": 48},
        "sla_compliance_pct": 82,
        "sla_breaches": 11,
        "recurring_problems": [
            {"location": "B Blok 2. Kat Erkek WC", "type": "SOAP_EMPTY", "count": 17}
        ],
        "slowest_department": {"name": "Bakım Onarım", "median_resolution_min": 310},
        "automation_rate_pct": 64,
    }
)


class _Polisher:
    def __init__(self, answer: str | Exception) -> None:
        self.answer = answer
        self.prompts: list[str] = []

    def polish(self, text: str, data: dict[str, object]) -> str:
        self.prompts.append(text)
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


def _summary(polisher: _Polisher | None = None, **changes: object) -> object:
    return AnalyticsSummaryAgent(polisher).run(KPI.model_copy(update=changes), CTX)


def test_every_sentence_comes_from_a_data_field() -> None:
    result = _summary()

    output = result.output
    assert output.source is SummarySource.TEMPLATE
    assert result.model == TEMPLATE_MODEL
    assert [s.field for s in output.sentences] == [
        "total_cases",
        "top_category",
        "highest_problem_location",
        "sla_compliance_pct",
        "recurring_problems",
        "slowest_department",
        "automation_rate_pct",
    ]
    text = output.text
    assert "186 bildirim" in text and "%14 artış" in text
    assert "Temizlik" in text and "71" in text
    assert "B Blok 2. Kat Erkek WC" in text and "17 kez" in text
    assert "5 saat 10 dakika" in text


def test_wording_matches_the_screens() -> None:
    # Ekranlar "tipik süre" ve "yapay zekâ" der (docs/UI_GUIDE.md); ozet ayni dili kullanir
    text = _summary().output.text

    assert "(tipik süre 5 saat 10 dakika)" in text
    assert "Yapay zekânın insan müdahalesi olmadan" in text
    assert "medyan" not in text
    assert "Agent" not in text


def test_a_decrease_is_worded_as_a_decrease() -> None:
    assert "%9 azalış" in _summary(previous_period_change_pct=-9).output.text


def test_missing_fields_are_skipped_not_invented() -> None:
    result = _summary(top_category=None, recurring_problems=[], slowest_department=None)

    fields = [s.field for s in result.output.sentences]
    assert "top_category" not in fields and "recurring_problems" not in fields
    assert "slowest_department" not in fields


def test_causal_language_is_never_used_by_the_template() -> None:
    assert not any(word in _summary().output.text for word in ("çünkü", "nedeniyle"))


# --- Opsiyonel LLM ve sayi korumasi -------------------------------------------------------


def test_a_faithful_rewrite_is_used() -> None:
    template = _summary().output.text
    polisher = _Polisher("Akıcı hali: " + template)

    result = _summary(polisher)

    assert result.output.source is SummarySource.LLM
    assert result.output.text.startswith("Akıcı hali")
    assert polisher.prompts == [template]


@pytest.mark.parametrize(
    ("answer", "reason"),
    [
        ("Bu hafta 190 bildirim açıldı.", "LLM_REJECTED_NUMBERS"),
        ("Temizlik bildirimleri personel eksikliği nedeniyle arttı.", "LLM_REJECTED_CAUSAL"),
        (PolisherUnavailableError("baglanti yok"), "LLM_UNAVAILABLE"),
    ],
)
def test_an_unfaithful_or_failed_rewrite_falls_back_to_the_template(
    answer: str | Exception, reason: str
) -> None:
    result = _summary(_Polisher(answer))

    assert result.output.source is SummarySource.TEMPLATE
    assert result.output.text == _summary().output.text
    assert reason in [r.code for r in result.reasons]


def test_number_check_accepts_numbers_from_the_data_and_the_template() -> None:
    allowed_text = "186 bildirim; tipik süre 5 saat 10 dakika. 19.09.2026"

    assert check_polished("Toplam 186; 5 saat 10 dakika, 19.09.2026.", allowed_text) is None
    assert check_polished("Toplam 187 bildirim.", allowed_text) == "LLM_REJECTED_NUMBERS"
    assert check_polished("Oran 186,5.", allowed_text) == "LLM_REJECTED_NUMBERS"
