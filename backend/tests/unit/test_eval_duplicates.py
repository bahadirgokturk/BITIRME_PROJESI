"""Mukerrer tespiti olcumu (test plani "Mukerrer tespiti"): elle kurulan cumle ciftleriyle
gercek Duplicate Agent'in precision ve recall'u."""

import io
from pathlib import Path

import pytest

from scripts.eval_duplicates import (
    COLUMNS,
    Pair,
    _seed_paths,
    confusion,
    location_paths,
    markdown_report,
    predict,
    read_pairs,
)

TREE = [
    {
        "code": "KMP",
        "children": [
            {
                "code": "A",
                "children": [
                    {"code": "A-1", "children": [{"code": "A-1-WCE"}, {"code": "A-1-KOR"}]},
                    {"code": "A-2", "children": [{"code": "A-2-WCE"}]},
                ],
            },
            {"code": "B", "children": [{"code": "B-Z", "children": [{"code": "B-Z-WCE"}]}]},
        ],
    }
]
HEADER = "pair_id,text_a,location_a,type_a,text_b,location_b,type_b,minutes_apart,same\n"


def _pair(**overrides: object) -> Pair:
    base: dict[str, object] = {
        "pair_id": "P1",
        "text_a": "Erkek tuvaletinde sabun bitmiş",
        "location_a": "A-1-WCE",
        "type_a": "SOAP_EMPTY",
        "text_b": "Sabunluk boş, el yıkayamıyoruz",
        "location_b": "A-1-WCE",
        "type_b": "SOAP_EMPTY",
        "minutes_apart": 20,
        "same": True,
    }
    return Pair(**{**base, **overrides})  # type: ignore[arg-type]


def test_location_paths_follow_the_seed_tree() -> None:
    paths = location_paths(TREE)

    assert paths["A-1-WCE"] == "KMP/A/A-1/A-1-WCE"
    assert paths["B-Z"] == "KMP/B/B-Z"
    assert paths["KMP"] == "KMP"


def test_same_spot_and_type_is_predicted_duplicate() -> None:
    assert predict(_pair(), location_paths(TREE)) == "DUPLICATE"


def test_point_problem_in_another_building_is_a_new_case() -> None:
    other = _pair(location_b="B-Z-WCE", same=False)

    assert predict(other, location_paths(TREE)) == "NEW_CASE"


def test_confusion_counts_strict_and_lenient_matches() -> None:
    truths = [True, True, False, False]
    decisions = ["DUPLICATE", "POSSIBLE_DUPLICATE", "POSSIBLE_DUPLICATE", "NEW_CASE"]

    strict = confusion(truths, [d == "DUPLICATE" for d in decisions])
    lenient = confusion(truths, [d != "NEW_CASE" for d in decisions])

    assert (strict["tp"], strict["fp"], strict["fn"], strict["tn"]) == (1, 0, 1, 2)
    assert (strict["precision"], strict["recall"]) == (1.0, 0.5)
    assert (lenient["precision"], lenient["recall"]) == (pytest.approx(0.6667), 1.0)


def test_confusion_without_positive_predictions_has_no_precision() -> None:
    assert confusion([True], [False])["precision"] is None


def test_read_pairs_parses_rows() -> None:
    row = "P7,sabun yok,A-1-WCE,SOAP_EMPTY,sabun bitti,A-2-WCE,SOAP_EMPTY,45,0\n"

    pairs = read_pairs(io.StringIO(HEADER + row), location_paths(TREE))

    assert pairs == [
        _pair(
            pair_id="P7",
            text_a="sabun yok",
            text_b="sabun bitti",
            location_b="A-2-WCE",
            minutes_apart=45,
            same=False,
        )
    ]


def test_unknown_location_names_the_pair() -> None:
    row = "P9,sabun yok,X-99,SOAP_EMPTY,sabun bitti,A-1-WCE,SOAP_EMPTY,10,1\n"

    with pytest.raises(ValueError, match="P9"):
        read_pairs(io.StringIO(HEADER + row), location_paths(TREE))


def test_markdown_report_shows_both_rules_and_the_errors() -> None:
    report = {
        "n": 2,
        "positives": 1,
        "strict": confusion([True, False], [True, True]),
        "lenient": confusion([True, False], [True, True]),
        "errors": [{"pair_id": "P2", "same": False, "decision": "DUPLICATE", "score": 0.81}],
    }

    text = markdown_report(report)

    assert "n = 2" in text
    assert "Otomatik birlestirme" in text
    assert "P2" in text


def test_negative_gap_is_rejected() -> None:
    row = "P3,sabun yok,A-1-WCE,SOAP_EMPTY,sabun bitti,A-1-WCE,SOAP_EMPTY,-5,1\n"

    with pytest.raises(ValueError, match="P3"):
        read_pairs(io.StringIO(HEADER + row), location_paths(TREE))


def test_template_uses_the_expected_columns_and_seed_locations() -> None:
    template = Path(__file__).resolve().parents[2] / "scripts/templates/duplicate_pairs.csv"
    text = template.read_text(encoding="utf-8")

    assert tuple(text.splitlines()[0].split(",")) == COLUMNS
    assert len(read_pairs(io.StringIO(text), _seed_paths())) == 2
