"""Haftalik yonetici raporu: hafta sinirlari, Turkce sayi bicimleri ve PDF icerigi."""

from datetime import UTC, date, datetime
from io import BytesIO

import pytest
from pypdf import PdfReader

from app.reports.weekly_model import KpiLine, WeeklyReport
from app.reports.weekly_pdf import render
from app.services.weekly_report_service import (
    fmt_change,
    fmt_minutes,
    fmt_pct,
    last_full_week,
    period_label,
    week_of,
)


def test_week_runs_monday_to_sunday() -> None:
    assert week_of(date(2026, 11, 12)) == (date(2026, 11, 9), date(2026, 11, 15))
    assert week_of(date(2026, 11, 9)) == (date(2026, 11, 9), date(2026, 11, 15))


def test_default_is_the_last_completed_week() -> None:
    # Cumartesi: icinde bulunulan hafta bitmedi, bir onceki hafta
    assert last_full_week(date(2026, 11, 14)) == (date(2026, 11, 2), date(2026, 11, 8))
    # Pazartesi: dun biten hafta
    assert last_full_week(date(2026, 11, 16)) == (date(2026, 11, 9), date(2026, 11, 15))


@pytest.mark.parametrize(
    ("minutes", "text"),
    [(None, "-"), (45, "45 dk"), (252, "4 sa 12 dk"), (1500, "1 gün 1 sa")],
)
def test_minutes_read_like_the_screens(minutes: float | None, text: str) -> None:
    assert fmt_minutes(minutes) == text


def test_percent_and_change() -> None:
    assert (fmt_pct(83.34), fmt_pct(None)) == ("%83", "-")
    assert (fmt_change(12.5), fmt_change(-4.6), fmt_change(None)) == ("+%13", "-%5", "-")


def test_period_label_in_turkish() -> None:
    assert period_label(date(2026, 11, 9), date(2026, 11, 15)) == "9 - 15 Kasım 2026"
    assert period_label(date(2026, 10, 26), date(2026, 11, 1)) == "26 Ekim - 1 Kasım 2026"


def _report() -> WeeklyReport:
    return WeeklyReport(
        organization="İzmir Bakırçay Üniversitesi",
        period="9 - 15 Kasım 2026",
        generated_at=datetime(2026, 11, 16, 8, 0, tzinfo=UTC),
        summary="Bu hafta 42 bildirim açıldı; en çok sorun Çöp dolu türünde.",
        kpis=[KpiLine("Toplam bildirim", "42", "35", "+%20")],
        departments=[("Destek Hizmetleri Şube Müdürlüğü", "30", "1 sa 5 dk", "%90", "4")],
        recurring=[("B Blok Zemin Kat WC", "Sabun bitti", "6", "Her gün rutin kontrol.")],
        risks=[("CASE-000412", "Koridor lambası sönük", "Bakım", "%87")],
    )


def test_pdf_contains_the_turkish_report() -> None:
    data = render(_report())

    assert data.startswith(b"%PDF")
    text = " ".join(page.extract_text() for page in PdfReader(BytesIO(data)).pages)
    for expected in (
        "Haftalık Yönetici Raporu",
        "9 - 15 Kasım 2026",
        "Destek Hizmetleri Şube Müdürlüğü",
        "Çöp dolu",
        "CASE-000412",
    ):
        assert expected in text


def test_empty_sections_say_so_instead_of_an_empty_table() -> None:
    empty = WeeklyReport(
        organization="Kurum",
        period="9 - 15 Kasım 2026",
        generated_at=datetime(2026, 11, 16, tzinfo=UTC),
        summary="",
        kpis=[],
        departments=[],
        recurring=[],
        risks=[],
    )

    text = PdfReader(BytesIO(render(empty))).pages[0].extract_text()

    assert "Bu hafta tekrar eden sorun yok." in text


def test_app_startup_does_not_load_the_pdf_library() -> None:
    import subprocess
    import sys

    code = "import app.main, sys; print('fpdf' in sys.modules)"
    # Sabit komut, dis girdi yok
    out = subprocess.run(  # noqa: S603
        [sys.executable, "-c", code], capture_output=True, text=True, check=True
    )

    assert out.stdout.strip() == "False"
