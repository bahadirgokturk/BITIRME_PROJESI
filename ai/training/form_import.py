"""Google Form cevaplari -> etiketleme tablosu (test plani "AI degerlendirme" adim 1-2).

Formdan "CSV indir" ile alinan dosya okunur. Her sorun cumlesi (birinci ve istege bagli ikinci) bir
satir olur; iki kisi label_a ve label_b sutunlarini birbirinden bagimsiz doldurur. Katilimcinin
sectigi konu yalniz yardimci bilgidir, dogru cevap degildir.

Form "kisisel bilgi yazmayin, yazilirsa silinir" der: e-posta, telefon ve uzun numaralar
etiketlemeden once maskelenir. Dosya acik repoya konmaz (data/raw gitignore'da).
"""

import csv
import io
import re
from collections.abc import Iterator

# Uygulama da daha kisa bildirimi kabul etmez (backend CASE_DESCRIPTION_MIN_LENGTH)
MIN_TEXT_LENGTH = 10
ATTENTION_ANSWER = "Orta"
ID_DIGITS = 3

SHEET_COLUMNS = [
    "id",
    "text",
    "respondent_topic",
    "location_hint",
    "urgency",
    "label_a",
    "label_b",
    "label_final",
    "note",
]

# Form sorularinin basliklari (ilk kelimeler); soru metni biraz degisse de bulunur
CONSENT = "aydınlatma"
FIRST_TEXT = "kampüste karşılaştığınız"
TOPIC = "bu sorun hangi konuyla"
LOCATION = "sorun nerede"
ATTENTION = "lütfen bu soruda"
URGENCY = "sizce bu sorun ne kadar acil"
SECOND_TEXT = "ikinci"

_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
# Turk cep/sabit telefonu: 0 ya da +90 ile, araya bosluk/tire girebilir
_PHONE = re.compile(r"(?:\+90|0)\s*\d{3}[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b")
# Ogrenci/TC numarasi gibi uzun sayilar; oda ve kat numaralari (kisa) kalir
_LONG_NUMBER = re.compile(r"\b\d{7,}\b")


def scrub(text: str) -> str:
    text = _EMAIL.sub("[e-posta]", text)
    text = _PHONE.sub("[telefon]", text)
    return _LONG_NUMBER.sub("[numara]", text)


def _fold(text: str) -> str:
    """Turkce kucuk harf: buyuk noktali I -> i (casefold noktali i + birlesik nokta verir)."""
    return text.strip().replace("İ", "i").replace("I", "ı").lower()


def _column(header: list[str], prefix: str) -> int | None:
    lowered = [_fold(name) for name in header]
    return next((i for i, name in enumerate(lowered) if prefix in name), None)


def _cell(row: list[str], index: int | None) -> str:
    if index is None or index >= len(row):
        return ""
    return row[index].strip()


def _problems(header: list[str], rows: list[list[str]]) -> Iterator[dict[str, str]]:
    columns = {
        key: _column(header, prefix)
        for key, prefix in {
            "consent": CONSENT,
            "first": FIRST_TEXT,
            "topic": TOPIC,
            "location": LOCATION,
            "attention": ATTENTION,
            "urgency": URGENCY,
            "second": SECOND_TEXT,
        }.items()
    }
    if columns["first"] is None:
        raise ValueError("Formda sorun cumlesi sutunu bulunamadi (baslik degismis olabilir)")
    for row in rows:
        if columns["consent"] is not None and not _cell(row, columns["consent"]):
            continue
        if (
            columns["attention"] is not None
            and _cell(row, columns["attention"]) != ATTENTION_ANSWER
        ):
            continue
        yield {
            "text": _cell(row, columns["first"]),
            "respondent_topic": _cell(row, columns["topic"]),
            "location_hint": _cell(row, columns["location"]),
            "urgency": _cell(row, columns["urgency"]),
        }
        # Ikinci sorun icin konu/yer sorulmadi: etiketleyici metinden karar verir
        yield {
            "text": _cell(row, columns["second"]),
            "respondent_topic": "",
            "location_hint": "",
            "urgency": "",
        }


def prepare_sheet(form_csv: str) -> list[dict[str, str]]:
    """Etiketlenecek satirlar; kisa ya da bos cevaplar atlanir, kisisel bilgi maskelenir."""
    header, *rows = list(csv.reader(io.StringIO(form_csv)))
    sheet: list[dict[str, str]] = []
    for problem in _problems(header, rows):
        text = scrub(problem["text"])
        if len(text) < MIN_TEXT_LENGTH:
            continue
        number = len(sheet) + 1
        sheet.append(
            {column: "" for column in SHEET_COLUMNS}
            | problem
            | {"id": f"R{number:0{ID_DIGITS}d}", "text": text}
        )
    return sheet
