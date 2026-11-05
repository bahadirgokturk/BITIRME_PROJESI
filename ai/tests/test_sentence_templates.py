from pathlib import Path

import pytest

from generators.sentence_templates import (
    CAMPUS_TEMPLATES_PATH,
    MIN_SENTENCES_PER_TYPE,
    TemplateError,
    load_templates,
)

# docs/DEPARTMENTS.md bolum 3'teki 19 case type (birim gorev tanimlarindan)
CAMPUS_CASE_TYPES = {
    "SOAP_EMPTY",
    "TOILET_PAPER_EMPTY",
    "TRASH_FULL",
    "AREA_DIRTY",
    "SECURITY_INCIDENT",
    "LOST_ITEM",
    "ELECTRICAL_FAILURE",
    "WATER_LEAK",
    "AIR_CONDITIONER_FAILURE",
    "ELEVATOR_FAILURE",
    "FURNITURE_DAMAGE",
    "GREEN_AREA",
    "WIFI_FAILURE",
    "COMPUTER_FAILURE",
    "PROJECTOR_FAILURE",
    "ACCESS_CONTROL_FAILURE",
    "CAFETERIA_ISSUE",
    "OTHER",
    "OUT_OF_SCOPE",
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


# Her anahtar kelime turunun en az bu kadar sablonunda gecmeli: sablon bazli testte bir sablon
# ayrilsa da model kelimeyi baska sablonlardan ogrenir (tek sablonda gecen kelime ogrenilemez)
MIN_TEMPLATES_PER_KEYWORD = 3
CASE_TYPES_SEED = (
    Path(__file__).resolve().parents[2]
    / "backend"
    / "seeds"
    / "templates"
    / "campus"
    / "case_types.yaml"
)


def test_every_seed_keyword_appears_in_several_templates() -> None:
    import yaml

    from training.normalization import normalize

    templates = load_templates(CAMPUS_TEMPLATES_PATH)
    seed = yaml.safe_load(CASE_TYPES_SEED.read_text(encoding="utf-8"))
    missing = []
    for case_type in seed["case_types"]:
        sentences = [f" {normalize(s)} " for s in templates[case_type["code"]]]
        for keyword in case_type["keywords"]:
            hits = sum(f" {normalize(keyword)}" in s for s in sentences)
            if hits < MIN_TEMPLATES_PER_KEYWORD:
                missing.append(f"{case_type['code']}:{keyword}={hits}")

    assert not missing, missing
