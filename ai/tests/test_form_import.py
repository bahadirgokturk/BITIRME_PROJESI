"""Google Form cevaplari -> etiketleme tablosu (docs/AGENTS.md 6.3, test plani adim 1)."""

import csv
import io

from training.form_import import SHEET_COLUMNS, prepare_sheet, scrub

HEADER = [
    "Zaman damgası",
    "Aydınlatma metni",
    "Kampüsteki rolünüz nedir?",
    "Kampüste karşılaştığınız bir sorunu, bir bildirim uygulamasına yazacağınız şekilde "
    "kısaca yazınız.",
    "Bu sorun hangi konuyla ilgili?",
    "Sorun nerede?",
    "Lütfen bu soruda “Orta” seçeneğini işaretleyiniz.",
    "Sizce bu sorun ne kadar acil?",
    "İkinci sorun (isteğe bağlı)",
]
CONSENT = "Okudum, anonim yanıtlarımın bu amaçla kullanılmasını kabul ediyorum."


def _form(*rows: list[str]) -> str:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(HEADER)
    writer.writerows(rows)
    return out.getvalue()


def _row(
    text: str, *, second: str = "", attention: str = "Orta", consent: str = CONSENT
) -> list[str]:
    return [
        "15.10.2026 10:00:00",
        consent,
        "Öğrenci",
        text,
        "Sabun / tuvalet kâğıdı eksikliği",
        "Tuvalet / lavabo",
        attention,
        "Orta: birkaç gün içinde çözülmeli",
        second,
    ]


def test_each_problem_becomes_one_row_to_label() -> None:
    sheet = prepare_sheet(
        _form(
            _row(
                "B Blok 2. kat erkek tuvaletinde sabun bitmiş.", second="Kütüphanede internet yok."
            ),
            _row("Yemekhanede çatallar kirli geliyor."),
        )
    )

    assert [row["text"] for row in sheet] == [
        "B Blok 2. kat erkek tuvaletinde sabun bitmiş.",
        "Kütüphanede internet yok.",
        "Yemekhanede çatallar kirli geliyor.",
    ]
    assert [row["id"] for row in sheet] == ["R001", "R002", "R003"]
    first = sheet[0]
    assert first["respondent_topic"] == "Sabun / tuvalet kâğıdı eksikliği"
    assert first["location_hint"] == "Tuvalet / lavabo"
    assert first["urgency"] == "Orta: birkaç gün içinde çözülmeli"
    # Ikinci sorunun konusu sorulmadi: etiketleyici metinden karar verir
    assert sheet[1]["respondent_topic"] == ""
    assert (first["label_a"], first["label_b"], first["label_final"]) == ("", "", "")
    assert list(first) == SHEET_COLUMNS


def test_answers_failing_the_attention_check_or_without_consent_are_dropped() -> None:
    sheet = prepare_sheet(
        _form(
            _row("A Blok projeksiyon cihazı açılmıyor.", attention="Yüksek"),
            _row("Kantinde fiyat listesi yok, karışıklık oluyor.", consent=""),
            _row("Koridordaki lamba yanıp sönüyor."),
        )
    )

    assert [row["text"] for row in sheet] == ["Koridordaki lamba yanıp sönüyor."]


def test_too_short_answers_are_dropped() -> None:
    # Uygulama da 10 karakterden kisa bildirimi kabul etmez
    sheet = prepare_sheet(_form(_row("bozuk"), _row("   "), _row("Asansör çalışmıyor.")))

    assert [row["text"] for row in sheet] == ["Asansör çalışmıyor."]


def test_personal_data_is_removed_before_labelling() -> None:
    # Form bunu soz verir: yanlislikla yazilan kisisel bilgi degerlendirmeden once silinir
    text = (
        "Oda 204 prizi yanık, bana ali.veli@ogr.bakircay.edu.tr ya da 0532 123 45 67 "
        "adresinden ulaşın, numaram 220402015"
    )

    cleaned = scrub(text)

    assert "ali.veli" not in cleaned and "0532" not in cleaned and "220402015" not in cleaned
    assert "[e-posta]" in cleaned and "[telefon]" in cleaned and "[numara]" in cleaned
    # Kisa sayilar (oda, kat) bildirimin parcasidir, silinmez
    assert "Oda 204" in cleaned


def test_attention_column_is_optional() -> None:
    header = [h for h in HEADER if not h.startswith("Lütfen")]
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(header)
    row = _row("Turnike kartı okumuyor.")
    writer.writerow(row[:6] + row[7:])

    sheet = prepare_sheet(out.getvalue())

    assert [r["text"] for r in sheet] == ["Turnike kartı okumuyor."]
