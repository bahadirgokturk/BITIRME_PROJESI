"""Fotograf onerisi olcumu: klasor adi gercek tur, gercek Vision Agent'in onerisi karsilastirilir.

Model yerine sahte tahminci; toplama, sayma ve tablo kurallari dogrudan denenir.
"""

from pathlib import Path

import pytest

from scripts.eval_photos import Photo, collect, evaluate, markdown_report


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
