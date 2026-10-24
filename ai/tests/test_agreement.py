"""Iki etiketleyicinin anlasmasi (Cohen's kappa) ve nihai etiket."""

import pytest

from training.agreement import InvalidLabelError, agreement, final_labels

KNOWN = {"SOAP_EMPTY", "WIFI_FAILURE", "TRASH_FULL", "OUT_OF_SCOPE"}


def _row(rid: str, a: str, b: str, final: str = "") -> dict[str, str]:
    return {"id": rid, "text": "metin", "label_a": a, "label_b": b, "label_final": final}


def test_perfect_agreement_has_kappa_one() -> None:
    rows = [_row("R1", "SOAP_EMPTY", "SOAP_EMPTY"), _row("R2", "WIFI_FAILURE", "WIFI_FAILURE")]

    result = agreement(rows, KNOWN)

    assert result.kappa == pytest.approx(1.0)
    assert (result.both_labelled, result.agreed, result.disagreements) == (2, 2, [])


def test_disagreements_are_listed_for_the_team_to_settle() -> None:
    rows = [
        _row("R1", "SOAP_EMPTY", "SOAP_EMPTY"),
        _row("R2", "TRASH_FULL", "SOAP_EMPTY"),
        _row("R3", "WIFI_FAILURE", "WIFI_FAILURE"),
        _row("R4", "OUT_OF_SCOPE", "OUT_OF_SCOPE"),
    ]

    result = agreement(rows, KNOWN)

    assert result.agreed == 3
    assert [d["id"] for d in result.disagreements] == ["R2"]
    assert result.kappa < 1.0


def test_rows_labelled_by_one_person_only_are_not_compared() -> None:
    rows = [_row("R1", "SOAP_EMPTY", "SOAP_EMPTY"), _row("R2", "WIFI_FAILURE", "")]

    assert agreement(rows, KNOWN).both_labelled == 1


def test_final_label_is_the_settled_one_or_the_agreed_one() -> None:
    rows = [
        _row("R1", "SOAP_EMPTY", "SOAP_EMPTY"),
        _row("R2", "TRASH_FULL", "SOAP_EMPTY", final="TRASH_FULL"),
        # Anlasmazlik cozulmediyse test setine girmez
        _row("R3", "TRASH_FULL", "WIFI_FAILURE"),
        _row("R4", "WIFI_FAILURE", ""),
    ]

    labelled = final_labels(rows, KNOWN)

    assert [(r["id"], r["label"]) for r in labelled] == [("R1", "SOAP_EMPTY"), ("R2", "TRASH_FULL")]


def test_unknown_codes_are_reported_with_their_rows() -> None:
    rows = [_row("R1", "SOAP", "SOAP_EMPTY"), _row("R2", "WIFI_FAILURE", "wifi_failure")]

    with pytest.raises(InvalidLabelError) as caught:
        agreement(rows, KNOWN)

    message = str(caught.value)
    assert "R1" in message and "SOAP" in message
    # Kucuk harf ve bosluk farki hata degil: kod buyuk harfe cevrilip karsilastirilir
    assert "R2" not in message
