import csv
from pathlib import Path

import pytest

from training.form_data import (
    CONSENT_ANSWER,
    CONSENT_COLUMN,
    TEXT_COLUMNS,
    clean_responses,
    labeling_rows,
    mask_personal_data,
    merge_labels,
    prepare_files,
)

FIRST, SECOND = TEXT_COLUMNS
VALID = {"SOAP_EMPTY", "WIFI_FAILURE", "OTHER"}


def response(first: str, second: str = "", consent: str = CONSENT_ANSWER) -> dict[str, str]:
    return {
        "Zaman damgası": "15.10.2026 10:00:00",
        CONSENT_COLUMN: consent,
        FIRST: first,
        SECOND: second,
    }


def labeled(rows: list[tuple[str, str, str]]) -> list[dict[str, str]]:
    return [{"id": row_id, "text": text, "label": label} for row_id, text, label in rows]


class TestCleanResponses:
    def test_keeps_both_answers_of_a_consenting_respondent(self) -> None:
        rows = [response("B blok tuvalette sabun bitmiş", "Kütüphanede wifi çekmiyor")]

        assert clean_responses(rows) == [
            "B blok tuvalette sabun bitmiş",
            "Kütüphanede wifi çekmiyor",
        ]

    def test_drops_answers_without_consent(self) -> None:
        assert clean_responses([response("Kantinde çay kalmamış", consent="")]) == []

    def test_drops_too_short_answers_like_the_report_form(self) -> None:
        # Backend CASE_DESCRIPTION_MIN_LENGTH = 10: uygulamada da gonderilemezdi
        assert clean_responses([response("sabun")]) == []

    def test_collapses_spaces_and_counts_a_sentence_once(self) -> None:
        rows = [response("  sabun   bitmiş\nB blok  "), response("Sabun bitmiş B blok")]

        assert clean_responses(rows) == ["sabun bitmiş B blok"]


class TestMaskPersonalData:
    @pytest.mark.parametrize(
        ("text", "expected"),
        [
            ("Bana ali.veli@ogr.bakircay.edu.tr adresinden yaz", "Bana [e-posta] adresinden yaz"),
            ("Ulaşamazsanız 0532 123 45 67 arayın", "Ulaşamazsanız [telefon] arayın"),
            ("numaram +90 532 1234567", "numaram [telefon]"),
            ("Öğrenci no 220510038 kartım okumuyor", "Öğrenci no [numara] kartım okumuyor"),
        ],
    )
    def test_masks_contact_details_and_long_numbers(self, text: str, expected: str) -> None:
        assert mask_personal_data(text) == expected

    def test_keeps_room_codes_and_floor_numbers(self) -> None:
        text = "B201 amfide 2. kat koridorunda 3 lamba yanmıyor"

        assert mask_personal_data(text) == text


class TestLabelingRows:
    def test_gives_stable_ids_and_empty_labels_in_a_seeded_order(self) -> None:
        texts = [f"Örnek bildirim cümlesi {i}" for i in range(5)]

        first = labeling_rows(texts, seed=7)

        assert first == labeling_rows(texts, seed=7)
        assert sorted(row["id"] for row in first) == ["R0001", "R0002", "R0003", "R0004", "R0005"]
        assert {row["label"] for row in first} == {""}


class TestMergeLabels:
    def test_perfect_agreement_gives_kappa_one(self) -> None:
        rows = [("R0001", "sabun bitmiş", "SOAP_EMPTY"), ("R0002", "wifi yok", "WIFI_FAILURE")]

        result = merge_labels(labeled(rows), labeled(rows), VALID)

        assert result.kappa == 1.0
        assert result.agreement == 1.0
        assert result.labeled == [("sabun bitmiş", "SOAP_EMPTY"), ("wifi yok", "WIFI_FAILURE")]
        assert result.disagreements == []

    def test_lists_disagreements_for_the_team_to_resolve(self) -> None:
        a = labeled([("R0001", "sabun bitmiş", "SOAP_EMPTY"), ("R0002", "garip ses", "OTHER")])
        b = labeled(
            [("R0001", "sabun bitmiş", "SOAP_EMPTY"), ("R0002", "garip ses", "WIFI_FAILURE")]
        )

        result = merge_labels(a, b, VALID)

        assert result.agreement == 0.5
        assert result.labeled == [("sabun bitmiş", "SOAP_EMPTY")]
        assert result.disagreements == [
            {
                "id": "R0002",
                "text": "garip ses",
                "label_a": "OTHER",
                "label_b": "WIFI_FAILURE",
                "final": "",
            }
        ]

    def test_adds_rows_the_team_resolved(self) -> None:
        a = labeled([("R0001", "garip ses", "OTHER")])
        b = labeled([("R0001", "garip ses", "WIFI_FAILURE")])
        resolved = [{"id": "R0001", "final": "OTHER"}]

        result = merge_labels(a, b, VALID, resolved=resolved)

        assert result.labeled == [("garip ses", "OTHER")]

    def test_rejects_an_unknown_label_code(self) -> None:
        a = labeled([("R0001", "sabun bitmiş", "SABUN")])

        with pytest.raises(ValueError, match=r"R0001.*SABUN"):
            merge_labels(a, a, VALID)

    def test_rejects_unlabeled_rows(self) -> None:
        a = labeled([("R0001", "sabun bitmiş", "")])

        with pytest.raises(ValueError, match="R0001"):
            merge_labels(a, a, VALID)

    def test_rejects_files_with_different_rows(self) -> None:
        a = labeled([("R0001", "sabun bitmiş", "SOAP_EMPTY")])
        b = labeled([("R0002", "sabun bitmiş", "SOAP_EMPTY")])

        with pytest.raises(ValueError, match="aynı satırlar"):
            merge_labels(a, b, VALID)


def test_prepare_files_writes_two_identical_labeling_sheets(tmp_path: Path) -> None:
    responses = tmp_path / "form.csv"
    with responses.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(response("x")))
        writer.writeheader()
        writer.writerow(response("B blok tuvalette sabun bitmiş", "Kütüphanede wifi çekmiyor"))

    count = prepare_files(responses, tmp_path / "labeling", seed=1)

    sheets = [
        (tmp_path / "labeling" / name).read_text(encoding="utf-8")
        for name in ("labeler_a.csv", "labeler_b.csv")
    ]
    assert count == 2
    assert sheets[0] == sheets[1]
    assert sheets[0].splitlines()[0] == "id,text,label"
