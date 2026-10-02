"""Classification Agent (AGENTS.md 4.2): ML tahmini, guvenlik kurali, kural tabanli yedek."""

from datetime import UTC, datetime

import numpy as np
import pytest

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.classification import (
    CaseTypeInfo,
    ClassificationAgent,
    ClassificationInput,
    LoadedClassifier,
)
from app.models.enums import CaseCategory

CTX = AgentContext(now=datetime(2026, 10, 2, 10, 0, tzinfo=UTC))
CASE_TYPES = [
    CaseTypeInfo(
        code="SOAP_EMPTY", category=CaseCategory.CONSUMABLE, keywords=["sabun", "sabunluk"]
    ),
    CaseTypeInfo(
        code="ELECTRICAL_FAILURE", category=CaseCategory.TECHNICAL, keywords=["elektrik", "priz"]
    ),
    CaseTypeInfo(code="SECURITY_INCIDENT", category=CaseCategory.SECURITY, keywords=["kavga"]),
    CaseTypeInfo(code="OTHER", category=CaseCategory.OTHER, keywords=[]),
]


class FakeModel:
    """sklearn benzeri: classes_ + predict_proba; olasiliklar testte sabit verilir."""

    classes_ = np.array(["ELECTRICAL_FAILURE", "OTHER", "SECURITY_INCIDENT", "SOAP_EMPTY"])

    def __init__(self, probabilities: list[float]) -> None:
        self._probabilities = probabilities

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        assert len(texts) == 1
        return np.array([self._probabilities])


def _run(description: str, model: FakeModel | None) -> object:
    loaded = LoadedClassifier(pipeline=model, version="1.0") if model else None
    inp = ClassificationInput(title="", description=description, case_types=CASE_TYPES)
    return ClassificationAgent(loaded).run(inp, CTX)


def test_model_prediction_with_top_candidates() -> None:
    result = _run("lavaboda sabun kalmamış", FakeModel([0.05, 0.10, 0.05, 0.80]))

    assert result.decision == "SOAP_EMPTY"
    assert result.confidence == pytest.approx(0.80)
    assert result.model == "tfidf-logreg@1.0"
    assert result.output.category is CaseCategory.CONSUMABLE
    assert [c.code for c in result.output.top_k] == ["SOAP_EMPTY", "OTHER", "ELECTRICAL_FAILURE"]
    assert result.output.matched_keywords == ["sabun"]
    assert "MODEL_PREDICTION" in {r.code for r in result.reasons}


def test_safety_words_override_a_harmless_prediction() -> None:
    # Model "sabun" dese de kivilcim gecen bildirim elektrik arizasi olarak ele alinir
    result = _run("Prizden KIVILCIM çıkıyor", FakeModel([0.15, 0.05, 0.05, 0.75]))

    assert result.decision == "ELECTRICAL_FAILURE"
    assert result.output.safety_override is True
    assert result.confidence == pytest.approx(0.15)
    assert "SAFETY_RULE" in {r.code for r in result.reasons}


def test_safety_rule_keeps_a_prediction_that_is_already_safety_related() -> None:
    result = _run("kavgada duman bombası atıldı", FakeModel([0.10, 0.05, 0.80, 0.05]))

    assert result.decision == "SECURITY_INCIDENT"
    assert result.output.safety_override is False


def test_keyword_rules_are_used_when_the_model_is_missing() -> None:
    result = _run("SABUNLUK BOŞ, sabun yok", None)

    assert result.decision == "SOAP_EMPTY"
    assert result.model == RULES_MODEL
    assert result.confidence == pytest.approx(1.0)
    assert result.output.matched_keywords == ["sabun", "sabunluk"]


def test_rules_without_any_match_fall_back_to_other() -> None:
    result = _run("çok garip bir durum var", None)

    assert result.decision == "OTHER"
    assert result.confidence == 0.0
    assert "NO_KEYWORD_MATCH" in {r.code for r in result.reasons}


def test_only_the_organisations_active_case_types_are_chosen() -> None:
    # Model SOAP_EMPTY dese de bu kurumda o tur yoksa siradaki aday secilir
    active = [ct for ct in CASE_TYPES if ct.code != "SOAP_EMPTY"]
    model = LoadedClassifier(pipeline=FakeModel([0.15, 0.05, 0.05, 0.75]), version="1.0")
    inp = ClassificationInput(title="", description="sabun yok", case_types=active)

    result = ClassificationAgent(model).run(inp, CTX)

    assert result.decision == "ELECTRICAL_FAILURE"
    assert "SOAP_EMPTY" not in {c.code for c in result.output.top_k}


def test_safety_rules_point_to_safety_related_seed_types() -> None:
    from pathlib import Path

    import yaml

    from app.agents.classification import SAFETY_RULES

    seed_path = Path(__file__).resolve().parents[3] / "seeds/templates/campus/case_types.yaml"
    seed = yaml.safe_load(seed_path.read_text(encoding="utf-8"))
    safety_types = {ct["code"] for ct in seed["case_types"] if ct["safety"]}

    assert {code for _, code in SAFETY_RULES} <= safety_types
