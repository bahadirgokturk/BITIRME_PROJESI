"""Fotograf onerisi icin istem bankasi: YAML'daki cumleler -> etiket ve normalize embedding."""

from pathlib import Path

import numpy as np
import pytest

from training.vision_prompts import (
    PROMPTS_YAML,
    ChecksumError,
    normalize_rows,
    sentences,
    verify_sha256,
)


def test_every_description_becomes_a_photo_sentence_with_its_type() -> None:
    spec = {"types": {"SOAP_EMPTY": ["an empty soap dispenser"], "_NONE": ["a person", "a street"]}}

    labels, texts = sentences(spec)

    assert labels == ["SOAP_EMPTY", "_NONE", "_NONE"]
    assert texts == [
        "a photo of an empty soap dispenser",
        "a photo of a person",
        "a photo of a street",
    ]


def test_rows_are_unit_length() -> None:
    rows = normalize_rows(np.array([[3.0, 4.0], [0.0, 2.0]], dtype=np.float32))

    assert np.allclose(np.linalg.norm(rows, axis=1), 1.0)
    assert rows.dtype == np.float32


def test_checksum_mismatch_is_refused(tmp_path: Path) -> None:
    model = tmp_path / "model.onnx"
    model.write_bytes(b"degistirilmis dosya")

    with pytest.raises(ChecksumError):
        verify_sha256(model, "0" * 64)


def test_repository_bank_only_uses_known_case_types() -> None:
    import yaml

    from training.real_eval import SEED_CASE_TYPES

    known = {
        t["code"] for t in yaml.safe_load(SEED_CASE_TYPES.read_text(encoding="utf-8"))["case_types"]
    }
    spec = yaml.safe_load(PROMPTS_YAML.read_text(encoding="utf-8"))

    assert set(spec["types"]) - {"_NONE"} <= known
    assert all(spec["types"].values())
