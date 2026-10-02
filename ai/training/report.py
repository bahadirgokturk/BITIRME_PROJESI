"""Egitim raporu: metrics.json -> tek dosyalik HTML (grafikler sayfaya gomulu veriden cizilir).

Her egitimde metrics.json'un yanina report.html yazilir; tarayicida acilir, dis kaynak gerekmez.
Tur adlari backend kampus seed'inden okunur (tek kaynak).
"""

import json
from pathlib import Path
from typing import Any

import yaml

# Rapor sayfasi; __DATA__ yerine metrikler gomulur
TEMPLATE_PATH = Path(__file__).with_name("report_template.html")
CASE_TYPES_SEED = (
    Path(__file__).resolve().parents[2]
    / "backend"
    / "seeds"
    / "templates"
    / "campus"
    / "case_types.yaml"
)


def _case_type_names() -> dict[str, str]:
    seed = yaml.safe_load(CASE_TYPES_SEED.read_text(encoding="utf-8"))
    return {case_type["code"]: case_type["name"] for case_type in seed["case_types"]}


def write_report(metrics: dict[str, Any], out: Path) -> None:
    payload = json.dumps({"metrics": metrics, "names": _case_type_names()}, ensure_ascii=False)
    # "</" JSON icinde script etiketini kapatamasin
    payload = payload.replace("</", "<\\/")
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    out.write_text(template.replace("__DATA__", payload), encoding="utf-8", newline="\n")
