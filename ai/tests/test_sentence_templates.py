from pathlib import Path

import pytest

from generators.sentence_templates import (
    CAMPUS_TEMPLATES_PATH,
    MIN_SENTENCES_PER_TYPE,
    TemplateError,
    load_templates,
)

# docs/AGENTS.md bolum "Autonomy" tablosundaki 11 case type
CAMPUS_CASE_TYPES = {
    "SOAP_EMPTY",
    "TOILET_PAPER_EMPTY",
    "TRASH_FULL",
    "AREA_DIRTY",
    "PROJECTOR_FAILURE",
    "AIR_CONDITIONER_FAILURE",
    "WIFI_FAILURE",
    "FURNITURE_DAMAGE",
    "ELECTRICAL_FAILURE",
    "WATER_LEAK",
    "OTHER",
}


def test_campus_templates_cover_all_case_types() -> None:
    templates = load_templates(CAMPUS_TEMPLATES_PATH)

    assert set(templates) == CAMPUS_CASE_TYPES


def test_each_case_type_has_enough_unique_sentences() -> None:
    templates = load_templates(CAMPUS_TEMPLATES_PATH)

    for code, sentences in templates.items():
        assert len(set(sentences)) >= MIN_SENTENCES_PER_TYPE, code


def _write(tmp_path: Path, content: str) -> Path:
    path = tmp_path / "t.yaml"
    path.write_text(content, encoding="utf-8")
    return path


def test_too_few_sentences_is_rejected(tmp_path: Path) -> None:
    path = _write(tmp_path, "case_types:\n  SOAP_EMPTY:\n    - sabun yok\n")

    with pytest.raises(TemplateError, match="SOAP_EMPTY"):
        load_templates(path)


def test_unknown_placeholder_is_rejected(tmp_path: Path) -> None:
    sentences = "".join(f"    - '{{room}} sabun yok {i}'\n" for i in range(10))
    path = _write(tmp_path, f"case_types:\n  SOAP_EMPTY:\n{sentences}")

    with pytest.raises(TemplateError, match="room"):
        load_templates(path)
