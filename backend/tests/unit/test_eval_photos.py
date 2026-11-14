"""Fotograf onerisi olcumu: klasor adi gercek tur, gercek Vision Agent'in onerisi karsilastirilir.

Model yerine sahte tahminci; toplama, sayma ve tablo kurallari dogrudan denenir.
"""

from pathlib import Path

import pytest

from app.agents.vision import TypeSuggestion
from scripts.eval_photos import (
    Photo,
    collect,
    evaluate,
    evaluate_photo_check,
    markdown_report,
    photo_check_markdown,
)


def _touch(root: Path, relative: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x")


def test_folder_name_is_the_true_type_and_other_files_are_skipped(tmp_path: Path) -> None:
    for name in ("SOAP_EMPTY/a.jpg", "SOAP_EMPTY/b.JPEG", "_NONE/selfie.png", "TRASH_FULL/c.heic"):
        _touch(tmp_path, name)
    _touch(tmp_path, "notlar.txt")

    photos, skipped = collect(tmp_path, known={"SOAP_EMPTY", "TRASH_FULL"})

    assert sorted((p.truth, p.path.name) for p in photos) == [
        ("SOAP_EMPTY", "a.jpg"),
        ("SOAP_EMPTY", "b.JPEG"),
        ("_NONE", "selfie.png"),
    ]
    assert [p.name for p in skipped] == ["c.heic"]


def test_unknown_folder_is_refused(tmp_path: Path) -> None:
    _touch(tmp_path, "SABUN/a.jpg")

    with pytest.raises(ValueError, match="SABUN"):
        collect(tmp_path, known={"SOAP_EMPTY"})


def _photos(*truths: str) -> list[Photo]:
    return [Photo(path=Path(f"{i}.jpg"), truth=truth) for i, truth in enumerate(truths)]


def test_report_separates_accuracy_coverage_and_false_alarms() -> None:
    answers = {
        "0.jpg": ["SOAP_EMPTY"],  # dogru
        "1.jpg": ["TOILET_PAPER_EMPTY", "SOAP_EMPTY"],  # ilk yanlis, ilk 3'te dogru
        "2.jpg": [],  # anlasilamadi
        "3.jpg": ["TRASH_FULL"],  # dogru
        "4.jpg": ["SOAP_EMPTY"],  # sorun yokken oneri: yanlis alarm
        "5.jpg": [],  # sorun yok, oneri yok: dogru
    }
    photos = _photos("SOAP_EMPTY", "SOAP_EMPTY", "SOAP_EMPTY", "TRASH_FULL", "_NONE", "_NONE")

    report = evaluate(photos, lambda photo: answers[photo.path.name])

    assert report["problem_photos"] == 4
    assert report["coverage"] == 0.75
    assert report["top1_when_suggested"] == pytest.approx(0.6667, abs=1e-4)
    assert report["top1_overall"] == 0.5
    assert report["top3_overall"] == 0.75
    assert report["none_photos"] == 2
    assert report["false_alarm_rate"] == 0.5
    assert report["per_type"]["SOAP_EMPTY"] == {"n": 3, "top1": 1, "suggested": 2}
    assert report["confusions"] == {"SOAP_EMPTY -> TOILET_PAPER_EMPTY": 1}


def test_report_without_none_photos_has_no_false_alarm_rate() -> None:
    report = evaluate(_photos("SOAP_EMPTY"), lambda _: ["SOAP_EMPTY"])

    assert report["false_alarm_rate"] is None


def test_markdown_table_for_the_thesis() -> None:
    report = evaluate(_photos("SOAP_EMPTY", "TRASH_FULL", "_NONE"), lambda p: ["SOAP_EMPTY"])

    text = markdown_report(report, skipped=1)

    assert "n = 3" in text
    assert "| SOAP_EMPTY | 1 | %100,0 | %100,0 |" in text
    assert "TRASH_FULL -> SOAP_EMPTY" in text
    assert "1 dosya" in text


def test_folder_may_carry_a_turkish_hint_after_the_code(tmp_path: Path) -> None:
    # Ekip klasoru "SOAP_EMPTY (Sabun bitti)" gibi acar; tur kodu ilk kelimedir
    _touch(tmp_path, "SOAP_EMPTY (Sabun bitti)/a.jpg")
    _touch(tmp_path, "_NONE (Sorun yok)/b.jpg")

    photos, _ = collect(tmp_path, known={"SOAP_EMPTY"})

    assert sorted(p.truth for p in photos) == ["SOAP_EMPTY", "_NONE"]


def _s(code: str, confidence: float) -> TypeSuggestion:
    return TypeSuggestion(case_type_code=code, confidence=confidence)


def _photo_check_answers() -> list[tuple[Photo, list[TypeSuggestion]]]:
    photos = _photos("SOAP_EMPTY", "SOAP_EMPTY", "TRASH_FULL", "_NONE")
    return [
        (photos[0], [_s("SOAP_EMPTY", 0.7)]),  # metin dogru: uyumlu; metin yanlis: celiski
        (photos[1], []),  # fotograf anlasilmadi
        (photos[2], [_s("SOAP_EMPTY", 0.4), _s("TRASH_FULL", 0.3)]),  # yanlis metne de uyar
        (photos[3], [_s("TRASH_FULL", 0.65)]),  # sorun yokken guclu oneri
    ]


def test_photo_check_scenarios_pair_each_photo_with_right_and_wrong_text() -> None:
    report = evaluate_photo_check(_photo_check_answers())

    # Metin dogru tur: celiski cikmasi yanlis alarmdir
    assert report["same"] == {"n": 3, "AGREES": 0.6667, "CONFLICTS": 0.0, "UNCLEAR": 0.3333}
    # Metin baska bir tur (setteki diger sorunlu turler): celiski yakalanmali
    assert report["other"] == {"n": 3, "AGREES": 0.3333, "CONFLICTS": 0.3333, "UNCLEAR": 0.3333}
    # Sorun gostermeyen fotograf, her sorunlu turle
    assert report["none"] == {"n": 2, "AGREES": 0.5, "CONFLICTS": 0.5, "UNCLEAR": 0.0}


def test_photo_check_without_photos_has_empty_rows() -> None:
    report = evaluate_photo_check([])

    assert report["same"] == {"n": 0, "AGREES": None, "CONFLICTS": None, "UNCLEAR": None}


def test_photo_check_table_for_the_thesis() -> None:
    text = photo_check_markdown(evaluate_photo_check(_photo_check_answers()))

    assert "| Metin dogru tur | 3 | %66,7 | %0,0 | %33,3 |" in text
    assert "| Metin baska tur | 3 | %33,3 | %33,3 | %33,3 |" in text
    assert "| Sorun gostermeyen fotograf | 2 | %50,0 | %50,0 | %0,0 |" in text
