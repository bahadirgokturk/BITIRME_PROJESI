"""docs/DEPARTMENTS.md tek kaynaktir: seed YAML'lari ve AI sablonlari onunla ayni olmali.

Tablo degisip seed unutulursa (ya da tersi) bu test kirmizi olur.
"""

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs" / "DEPARTMENTS.md"
SEED_DIR = ROOT / "backend" / "seeds" / "templates" / "campus"
AI_TEMPLATES = ROOT / "ai" / "generators" / "templates" / "campus.yaml"

AUTONOMY = {"L1": "L1_AUTONOMOUS", "L2": "L2_NOTIFY", "L3": "L3_ESCALATE"}
# Tablo satiri: | `KOD` | ... |
ROW = re.compile(r"^\| `(?P<code>[A-Z_]+)` \|(?P<rest>.*)\|$")
EMPTY_CELL = "—"

Row = tuple[str, ...]


def _section_rows(heading: str) -> dict[str, Row]:
    text = DOC.read_text(encoding="utf-8")
    section = text.split(heading, 1)[1].split("\n## ", 1)[0]
    rows: dict[str, Row] = {}
    for line in section.splitlines():
        match = ROW.match(line.strip())
        if match:
            cells = tuple(cell.strip() for cell in match["rest"].split("|"))
            rows[match["code"]] = cells
    return rows


def _department(cell: str) -> str | None:
    # Tire ile baslayan hucreler (or. "tire (insan inceler)") birim yok demektir
    return None if cell.startswith(EMPTY_CELL) else cell


def _doc_case_types() -> dict[str, tuple[str, str | None, str | None, str]]:
    # Sutunlar (kod haric): ad | kategori | birincil | ikincil | otonomi | kaynak
    return {
        code: (cells[1], _department(cells[2]), _department(cells[3]), AUTONOMY[cells[4]])
        for code, cells in _section_rows("## 3.").items()
    }


def _seed(name: str) -> dict[str, object]:
    with (SEED_DIR / name).open(encoding="utf-8") as file:
        data: dict[str, object] = yaml.safe_load(file)
    return data


def _seed_case_types() -> dict[str, tuple[str, str | None, str | None, str]]:
    items = _seed("case_types.yaml")["case_types"]
    assert isinstance(items, list)
    return {
        item["code"]: (item["category"], item["primary"], item["secondary"], item["autonomy"])
        for item in items
    }


def test_departments_match_the_document() -> None:
    items = _seed("departments.yaml")["departments"]
    assert isinstance(items, list)

    assert {item["code"] for item in items} == set(_section_rows("## 2."))


def test_case_types_match_the_document() -> None:
    doc = _doc_case_types()
    seed = _seed_case_types()

    assert set(seed) == set(doc)
    for code, expected in doc.items():
        assert seed[code] == expected, code


def test_ai_templates_cover_the_same_case_types() -> None:
    with AI_TEMPLATES.open(encoding="utf-8") as file:
        templates = yaml.safe_load(file)["case_types"]

    assert set(templates) == set(_doc_case_types())


def test_safety_flag_matches_escalation() -> None:
    # L3 tipler guvenlik kurali tetikler (docs/AGENTS.md SAFETY_RULE); bayrak ile seviye ayrismasin
    items = _seed("case_types.yaml")["case_types"]
    assert isinstance(items, list)

    for item in items:
        assert item["safety"] is (item["autonomy"] == "L3_ESCALATE"), item["code"]
