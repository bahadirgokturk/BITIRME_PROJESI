"""Sentetik bildirim uretici icin case type bazli sablon cumleleri yukler ve dogrular."""

import string
from pathlib import Path

import yaml

CAMPUS_TEMPLATES_PATH = Path(__file__).parent / "templates" / "campus.yaml"
# Sprint 1 kabul kriteri: her case type icin en az 10 farkli cumle (docs/PROJECT_PLAN.md bolum 4)
MIN_SENTENCES_PER_TYPE = 10
# Uretici yalniz lokasyon adini doldurur; baska yer tutucu hata sayilir
ALLOWED_PLACEHOLDERS = {"location"}


class TemplateError(ValueError):
    pass


def _placeholders(sentence: str) -> set[str]:
    return {field for _, field, _, _ in string.Formatter().parse(sentence) if field is not None}


def _validate(code: str, sentences: list[str]) -> None:
    if len(set(sentences)) < MIN_SENTENCES_PER_TYPE:
        raise TemplateError(f"{code}: en az {MIN_SENTENCES_PER_TYPE} farkli cumle gerekli")
    unknown = set().union(*(_placeholders(s) for s in sentences)) - ALLOWED_PLACEHOLDERS
    if unknown:
        raise TemplateError(f"{code}: bilinmeyen yer tutucu {sorted(unknown)}")


def load_templates(path: Path) -> dict[str, list[str]]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    templates: dict[str, list[str]] = data["case_types"]
    for code, sentences in templates.items():
        _validate(code, sentences)
    return templates
