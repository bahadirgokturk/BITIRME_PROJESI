"""Ogrenen model (v2): mudur duzeltmeleri egitime eklenir, test setine sizmaz."""

from pathlib import Path

from training.feedback import FEEDBACK_REPEAT, load_feedback


def _write(path: Path, rows: list[tuple[str, str]]) -> Path:
    lines = ["text,label,case_number,corrected_at"]
    lines += [f'"{text}",{label},CASE-1,2026-10-01T10:00:00+00:00' for text, label in rows]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def test_each_correction_becomes_weighted_training_samples(tmp_path: Path) -> None:
    csv_path = _write(tmp_path / "f.csv", [("Lavabo sabunluk boş", "SOAP_EMPTY")])

    samples = load_feedback(csv_path, holdout=set())

    # Gercek ve dogrulanmis ornek: sentetik sablonlardan daha cok agirlik (tekrar) alir
    assert len(samples) == FEEDBACK_REPEAT
    assert {(s.text, s.label) for s in samples} == {("Lavabo sabunluk boş", "SOAP_EMPTY")}
    # Ayni duzeltme capraz dogrulamada tek grup: kendi kopyasiyla test edilmez
    assert len({s.template_id for s in samples}) == 1


def test_sentences_in_the_test_set_are_never_trained_on(tmp_path: Path) -> None:
    csv_path = _write(
        tmp_path / "f.csv",
        [("Kütüphanede İnternet yok", "WIFI_FAILURE"), ("Asansör takıldı", "ELEVATOR_FAILURE")],
    )

    # Test setindeki cumle buyuk/kucuk harf ve bosluk farkiyla da yakalanir
    samples = load_feedback(csv_path, holdout={"  kütüphanede internet YOK "})

    assert {s.label for s in samples} == {"ELEVATOR_FAILURE"}
