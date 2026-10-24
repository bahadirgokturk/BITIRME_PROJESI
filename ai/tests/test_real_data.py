"""Tez tablosu: model ve temel yontem yan yana, sistem esigi isaretli."""

from training.real_data import markdown_report


def _metrics(accuracy: float, macro_f1: float) -> dict[str, float]:
    return {"accuracy": accuracy, "macro_f1": macro_f1}


def test_markdown_table_for_the_thesis() -> None:
    report = {
        "n": 120,
        "model": _metrics(0.8417, 0.8012),
        "baseline": _metrics(0.55, 0.4833),
        "thresholds": [
            {"threshold": 0.7, "auto_share": 0.75, "auto_accuracy": 0.92, "review_share": 0.25},
            {"threshold": 0.9, "auto_share": 0.4, "auto_accuracy": None, "review_share": 0.6},
        ],
    }

    text = markdown_report(report, kappa=0.81)

    assert "n = 120" in text
    assert "| TF-IDF + LR (model) | %84,2 | %80,1 |" in text
    assert "| Anahtar kelime (temel) | %55,0 | %48,3 |" in text
    assert "| 0.70 (sistem) | %75,0 | %92,0 | %25,0 |" in text
    assert "| 0.90 | %40,0 | - | %60,0 |" in text
    assert "kappa): 0.81" in text


def test_comparison_table_lists_every_model() -> None:
    from training.real_data import comparison_markdown

    report = {
        "n": 40,
        "baseline": _metrics(0.5, 0.45),
        "models": {"v1": _metrics(0.8, 0.75), "v2": _metrics(0.85, 0.82)},
    }

    text = comparison_markdown(report)

    assert "| Anahtar kelime (temel) | %50,0 | %45,0 |" in text
    assert "| v1 | %80,0 | %75,0 |" in text
    assert "| v2 | %85,0 | %82,0 |" in text
