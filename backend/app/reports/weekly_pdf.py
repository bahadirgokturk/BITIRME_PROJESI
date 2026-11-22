"""Haftalik yonetici raporu PDF'i (fpdf2). Yalniz yerlesim: veriler ve sayi bicimleri
services/weekly_report_service.py'de hazirlanir, burada hesap yapilmaz.

fpdf2 yuklenince ~50 MB bellek kullanir: bu modul yalniz rapor istenince yuklenir (servisteki
ic import), uygulama acilisi etkilenmez (Render 512 MB).

Font DejaVu Sans (Turkce harfler; lisans fonts/LICENSE-DejaVu.txt). A4 dikey, tek sutun.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from fpdf import FPDF, FontFace
from fpdf.enums import XPos, YPos

from app.analytics.scope import TURKEY
from app.reports.weekly_model import WeeklyReport

FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONT = "DejaVu"
TITLE = "Haftalık Yönetici Raporu"
FOOTER = "BakırçayFlow tarafından otomatik üretildi; sayılar sistem kayıtlarından hesaplanır."
# Yazi boyutlari (pt) ve satir yuksekligi (mm)
TITLE_SIZE = 18
HEADING_SIZE = 12
BODY_SIZE = 9.5
SMALL_SIZE = 8
LINE_MM = 5.5
SECTION_GAP_MM = 4
MARGIN_MM = 15
# Tablo basligi zemini (acik gri) ve marka rengi (turkuaz)
HEADER_FILL = (235, 240, 242)
BRAND = (0, 128, 140)
# Tablo sutun genislikleri: sayfa genisligine oranla
DEPARTMENT_COLUMNS = (0.46, 0.12, 0.16, 0.13, 0.13)
RECURRING_COLUMNS = (0.30, 0.20, 0.08, 0.42)
RISK_COLUMNS = (0.17, 0.43, 0.25, 0.15)
KPI_COLUMNS = (0.40, 0.20, 0.20, 0.20)


class _Pdf(FPDF):
    def footer(self) -> None:
        self.set_y(-MARGIN_MM)
        self.set_font(FONT, size=SMALL_SIZE)
        self.set_text_color(120)
        self.cell(0, LINE_MM, f"{FOOTER}  ·  Sayfa {self.page_no()}", align="C")


def _heading(pdf: FPDF, text: str) -> None:
    pdf.ln(SECTION_GAP_MM)
    pdf.set_font(FONT, "B", HEADING_SIZE)
    pdf.set_text_color(*BRAND)
    pdf.cell(0, LINE_MM + 1, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0)
    pdf.set_font(FONT, size=BODY_SIZE)


@dataclass(frozen=True)
class _Section:
    title: str
    headers: tuple[str, ...]
    rows: Sequence[Sequence[str]]
    widths: tuple[float, ...]
    # Satir yoksa tablo yerine yazilan cumle
    empty: str


def _section(pdf: FPDF, section: _Section) -> None:
    _heading(pdf, section.title)
    if not section.rows:
        pdf.multi_cell(0, LINE_MM, section.empty, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        return
    headings = FontFace(emphasis="BOLD", fill_color=HEADER_FILL)
    with pdf.table(
        col_widths=section.widths,
        headings_style=headings,
        borders_layout="HORIZONTAL_LINES",
        line_height=LINE_MM,
        text_align="LEFT",
    ) as table:
        for row in (section.headers, *section.rows):
            table.row(list(row))


def render(report: WeeklyReport) -> bytes:
    pdf = _Pdf(format="A4")
    pdf.set_margins(MARGIN_MM, MARGIN_MM, MARGIN_MM)
    pdf.set_auto_page_break(auto=True, margin=MARGIN_MM + LINE_MM)
    pdf.add_font(FONT, "", str(FONT_DIR / "DejaVuSans.ttf"))
    pdf.add_font(FONT, "B", str(FONT_DIR / "DejaVuSans-Bold.ttf"))
    pdf.set_title(f"{TITLE} - {report.period}")
    pdf.add_page()

    pdf.set_font(FONT, "B", TITLE_SIZE)
    pdf.set_text_color(*BRAND)
    pdf.cell(0, LINE_MM * 2, f"BakırçayFlow · {TITLE}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0)
    pdf.set_font(FONT, size=BODY_SIZE)
    generated = report.generated_at.astimezone(TURKEY).strftime("%d.%m.%Y %H:%M")
    pdf.multi_cell(
        0,
        LINE_MM,
        f"{report.organization}\nDönem: {report.period}   ·   Oluşturulma: {generated}",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    _heading(pdf, "Yönetim özeti")
    pdf.multi_cell(0, LINE_MM, report.summary or "Bu dönem için özet üretilemedi.")

    kpi_rows = [(k.label, k.value, k.previous, k.change) for k in report.kpis]
    sections = (
        _Section(
            "Temel göstergeler",
            ("Gösterge", "Bu hafta", "Önceki hafta", "Değişim"),
            kpi_rows,
            KPI_COLUMNS,
            "Bu hafta gösterge hesaplanacak bildirim yok.",
        ),
        _Section(
            "Birim performansı",
            ("Birim", "Bildirim", "Tipik çözüm", "SLA uyumu", "Açık görev"),
            report.departments,
            DEPARTMENT_COLUMNS,
            "Aktif birim yok.",
        ),
        _Section(
            "Tekrar eden sorunlar (son 30 gün)",
            ("Yer", "Tür", "Adet", "Öneri"),
            report.recurring,
            RECURRING_COLUMNS,
            "Bu hafta tekrar eden sorun yok.",
        ),
        _Section(
            "Şu an gecikme riski yüksek bildirimler",
            ("Numara", "Başlık", "Birim", "Risk"),
            report.risks,
            RISK_COLUMNS,
            "Gecikme riski yüksek açık bildirim yok.",
        ),
    )
    for section in sections:
        _section(pdf, section)
    return bytes(pdf.output())
