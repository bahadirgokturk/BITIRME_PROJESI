import json
from pathlib import Path

from training.report import write_report

METRICS = {
    "version": "1.0",
    "sklearn_version": "1.9.1",
    "seed": 42,
    "evaluation": {
        "n": 2,
        "accuracy": 0.8207,
        "macro_f1": 0.8153,
        "accuracy_std": 0.03,
        "macro_f1_std": 0.03,
        "latency_ms": {"p50": 12.1, "p95": 15.2},
        "folds": [{"n": 2, "accuracy": 0.82, "macro_f1": 0.81}],
        "per_class": {"SOAP_EMPTY": {"precision": 1, "recall": 1, "f1": 1, "support": 1}},
        "confusion_matrix": {"labels": ["SOAP_EMPTY"], "matrix": [[1]]},
    },
}


def test_report_embeds_the_metrics_in_a_standalone_page(tmp_path: Path) -> None:
    out = tmp_path / "report.html"

    write_report(METRICS, out)

    html = out.read_text(encoding="utf-8")
    assert html.startswith("<!doctype html>")
    assert "__DATA__" not in html
    # Grafikler sayfaya gomulu veriden cizilir; dis kaynak yok
    payload = html.split('<script id="data" type="application/json">')[1].split("</script>")[0]
    assert json.loads(payload)["metrics"]["evaluation"]["accuracy"] == 0.8207
    assert "Sabun bitti" in payload  # kod yerine Turkce tur adlari gosterilir
