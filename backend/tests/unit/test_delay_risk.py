"""SLA gecikme riski: bildirim acildigi anda bilinenlerle, suresi asilacak mi tahmini.

Model gecmiste kapanan bildirimlerle egitilir; olcum zaman sirasina gore yapilir (eski
bildirimlerle egit, en yenilerde test et), boylece gelecegi gormus gibi sisirilmez.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.analytics.delay_risk import CaseFacts, backlog_at, explain, fit, risk

START = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)


def _facts(index: int, *, backlog: int, priority: str, breached: bool | None) -> CaseFacts:
    return CaseFacts(
        case_id=index,
        # Tur, birim ve hedef sure sabit: risk yuk ve oncelikten okunmali
        created_at=START + timedelta(days=index // 4, hours=index % 4),
        category="CONSUMABLE",
        priority=priority,
        department="SUPPORT_SERVICES",
        sla_minutes=240,
        backlog=backlog,
        breached=breached,
    )


def _history(size: int = 80) -> list[CaseFacts]:
    # Yogun birim + dusuk oncelik gecikir; sakin birim + yuksek oncelik zamaninda biter
    rows = []
    for index in range(size):
        busy = index % 2 == 0
        rows.append(
            _facts(
                index,
                backlog=12 + index % 3 if busy else 1 + index % 2,
                priority="LOW" if busy else "HIGH",
                breached=busy if index % 10 else not busy,
            )
        )
    return rows


def test_busy_low_priority_cases_score_higher() -> None:
    model = fit(_history())

    assert model is not None
    risky = risk(model, _facts(900, backlog=13, priority="LOW", breached=None))
    calm = risk(model, _facts(901, backlog=1, priority="HIGH", breached=None))
    assert 0.0 <= calm < risky <= 1.0


def test_quality_is_measured_on_the_newest_cases() -> None:
    model = fit(_history())

    assert model is not None
    assert model.train_n + model.test_n == 80
    # En yeni %30 testte
    assert model.test_n == 24
    assert model.auc is not None and model.auc > 0.7
    # Yogun birimdeki 40 bildirimin 32si gecikti (her onuncu istisna), sakinlerin hicbiri
    assert model.base_rate == pytest.approx(0.4)


def test_explanation_names_what_pushes_the_risk_up() -> None:
    model = fit(_history())

    assert model is not None
    factors = explain(model, _facts(900, backlog=14, priority="LOW", breached=None))

    assert factors[0].feature in {"backlog", "priority"}
    assert all(factor.effect > 0 for factor in factors)


def test_too_little_history_gives_no_model() -> None:
    assert fit(_history(size=10)) is None


def test_history_where_nothing_was_late_gives_no_model() -> None:
    on_time = [_facts(i, backlog=2, priority="LOW", breached=False) for i in range(80)]

    assert fit(on_time) is None


def test_backlog_counts_cases_still_open_in_the_same_department() -> None:
    at = START + timedelta(hours=10)
    cases = [
        # Sira: birim, acilis zamani, kapanis zamani
        ("SUPPORT", START, None),
        ("SUPPORT", START + timedelta(hours=1), START + timedelta(hours=2)),
        ("SUPPORT", START + timedelta(hours=2), START + timedelta(hours=12)),
        ("MAINT", START, None),
        # Sonra acilan sayilmaz
        ("SUPPORT", START + timedelta(hours=11), None),
    ]

    assert backlog_at("SUPPORT", at, cases) == 2
