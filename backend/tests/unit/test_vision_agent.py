"""Vision Agent (fotograftan tur onerisi): CLIP goruntu vektoru istem bankasiyla karsilastirilir.

Gercek model yerine kucuk, elle kurulmus vektorler: karar kurallari (esik, en fazla 3 oneri,
_NONE kazanirsa oneri yok) dogrudan denenir.
"""

import json
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.agents.base import AgentContext
from app.agents.vision import MAX_SUGGESTIONS, PromptBank, VisionAgent, VisionInput
from app.agents.vision_model import VISION_DIR, load_bank, load_vision, to_pixels

CTX = AgentContext(now=datetime(2026, 11, 1, 10, 0, tzinfo=UTC))
AXES = {"SOAP_EMPTY": 0, "TRASH_FULL": 1, "WATER_LEAK": 2, "_NONE": 3}


def _bank() -> PromptBank:
    labels = tuple(AXES)
    return PromptBank(labels=labels, embeddings=np.eye(len(labels), dtype=np.float32))


def _toward(weights: dict[str, float]) -> list[float]:
    vector = np.zeros(len(AXES), dtype=np.float32)
    for code, weight in weights.items():
        vector[AXES[code]] = weight
    return (vector / np.linalg.norm(vector)).tolist()


def _run(weights: dict[str, float]):  # type: ignore[no-untyped-def]
    return VisionAgent(_bank()).run(VisionInput(image_embedding=_toward(weights)), CTX)


def test_clear_photo_suggests_its_type_first() -> None:
    result = _run({"SOAP_EMPTY": 1.0, "TRASH_FULL": 0.2})

    assert result.decision == "SUGGESTED"
    assert result.output.suggestions[0].case_type_code == "SOAP_EMPTY"
    assert result.output.suggestions[0].confidence > 0.9
    assert result.reasons[0].message


def test_photo_without_a_problem_gets_no_suggestion() -> None:
    result = _run({"_NONE": 1.0, "SOAP_EMPTY": 0.1})

    assert result.decision == "UNRECOGNISED"
    assert result.output.suggestions == []


def test_undecided_photo_gets_no_suggestion() -> None:
    # Uc tur esit benzer: hicbiri esige ulasmaz
    result = _run({"SOAP_EMPTY": 1.0, "TRASH_FULL": 1.0, "WATER_LEAK": 1.0})

    assert result.decision == "UNRECOGNISED"


def test_suggestions_are_ranked_capped_and_never_include_none() -> None:
    result = _run({"SOAP_EMPTY": 1.0, "TRASH_FULL": 0.98, "WATER_LEAK": 0.97, "_NONE": 0.96})

    codes = [s.case_type_code for s in result.output.suggestions]
    confidences = [s.confidence for s in result.output.suggestions]
    assert "_NONE" not in codes
    assert len(codes) <= MAX_SUGGESTIONS
    assert confidences == sorted(confidences, reverse=True)


def _jpeg(width: int, height: int) -> bytes:
    output = BytesIO()
    Image.new("RGB", (width, height), (200, 30, 30)).save(output, format="JPEG")
    return output.getvalue()


def test_photo_becomes_a_normalized_224_square_tensor() -> None:
    manifest = json.loads((VISION_DIR / "manifest.json").read_text(encoding="utf-8"))

    pixels = to_pixels(_jpeg(1200, 900), manifest)

    assert pixels.shape == (1, 3, 224, 224)
    assert pixels.dtype == np.float32
    # Kirmizi kanal ortalamanin ustunde, mavi altinda (renk sirasi RGB)
    assert pixels[0, 0].mean() > 0 > pixels[0, 2].mean()


def test_png_with_transparency_is_accepted() -> None:
    output = BytesIO()
    Image.new("RGBA", (300, 500), (0, 0, 0, 0)).save(output, format="PNG")
    manifest = json.loads((VISION_DIR / "manifest.json").read_text(encoding="utf-8"))

    assert to_pixels(output.getvalue(), manifest).shape == (1, 3, 224, 224)


def test_repository_bank_matches_the_prompt_file() -> None:
    import yaml

    bank = load_bank(VISION_DIR)
    spec = yaml.safe_load((VISION_DIR / "prompts.yaml").read_text(encoding="utf-8"))

    assert len(bank.labels) == sum(len(v) for v in spec["types"].values())
    assert set(bank.labels) == set(spec["types"])
    assert np.allclose(np.linalg.norm(bank.embeddings, axis=1), 1.0, atol=1e-4)


def test_missing_model_file_disables_vision(tmp_path: Path) -> None:
    assert load_vision(tmp_path / "yok.onnx") is None


def test_dockerfile_downloads_the_manifest_model() -> None:
    manifest = json.loads((VISION_DIR / "manifest.json").read_text(encoding="utf-8"))
    dockerfile = (Path(__file__).resolve().parents[2] / "Dockerfile").read_text(encoding="utf-8")

    assert manifest["revision"] in dockerfile
    assert manifest["vision_file"] in dockerfile
    assert manifest["vision_sha256"] in dockerfile


@pytest.mark.parametrize("data", [b"", b"\xff\xd8\xff bozuk jpeg"])
def test_broken_image_raises_a_decode_error(data: bytes) -> None:
    from app.services.image_policy import DECODE_ERRORS

    manifest = json.loads((VISION_DIR / "manifest.json").read_text(encoding="utf-8"))
    with pytest.raises(DECODE_ERRORS):
        to_pixels(data, manifest)


def test_none_winning_by_a_little_still_blocks_the_runner_up() -> None:
    # _NONE az farkla kazaniyor; ikinci tur liste esiginin ustunde ama oneri yine verilmez
    result = _run({"_NONE": 1.0, "SOAP_EMPTY": 0.995})

    assert result.decision == "UNRECOGNISED"
    assert result.output.suggestions == []
