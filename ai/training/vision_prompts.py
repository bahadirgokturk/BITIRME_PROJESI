"""Fotograftan tur onerisi (Vision Agent) icin istem bankasi.

backend/ml_models/vision/v1/prompts.yaml'daki her cumle CLIP metin modelinden gecer; normalize
edilmis vektorler prompts.npz'ye yazilir. Backend calisirken yalniz goruntu modelini kullanir, metin
modeli (64 MB) sunucuya girmez. Model dosyalari manifest.json'daki sabit surumden indirilir ve
SHA-256 ile dogrulanir; yerel kopya ai/models/clip altinda kalir (repoya girmez).

Kullanim (ai/ klasorunde): uv run python -m training.vision_prompts
"""

import hashlib
import json
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import yaml

VISION_DIR = Path(__file__).resolve().parents[2] / "backend/ml_models/vision/v1"
PROMPTS_YAML = VISION_DIR / "prompts.yaml"
MANIFEST = VISION_DIR / "manifest.json"
BANK_FILE = VISION_DIR / "prompts.npz"
CACHE_DIR = Path(__file__).resolve().parents[1] / "models/clip"
PHOTO_PREFIX = "a photo of "
# CLIP metin baglami 77 token; padding id'si son token (<|endoftext|>)
CONTEXT_LENGTH = 77
PAD_ID = 49407
DOWNLOAD_TIMEOUT_SECONDS = 120
CHUNK_BYTES = 1 << 20


class ChecksumError(Exception):
    pass


def sentences(spec: dict[str, Any]) -> tuple[list[str], list[str]]:
    labels: list[str] = []
    texts: list[str] = []
    for code, descriptions in spec["types"].items():
        for description in descriptions:
            labels.append(code)
            texts.append(PHOTO_PREFIX + description)
    return labels, texts


def normalize_rows(rows: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(rows, axis=1, keepdims=True)
    normalized: np.ndarray = (rows / norms).astype(np.float32)
    return normalized


def verify_sha256(path: Path, expected: str) -> None:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_BYTES), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise ChecksumError(f"{path.name}: SHA-256 beklenenden farkli")


def _fetch(manifest: dict[str, Any], key: str) -> Path:
    remote = manifest[f"{key}_file"]
    target = CACHE_DIR / Path(remote).name
    if not target.exists():
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        url = f"https://huggingface.co/{manifest['model']}/resolve/{manifest['revision']}/{remote}"
        with urllib.request.urlopen(url, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            target.write_bytes(response.read())
    verify_sha256(target, manifest[f"{key}_sha256"])
    return target


def _embed(texts: list[str], manifest: dict[str, Any]) -> np.ndarray:
    import onnxruntime as ort
    from tokenizers import Tokenizer

    tokenizer = Tokenizer.from_file(str(_fetch(manifest, "tokenizer")))
    tokenizer.enable_padding(length=CONTEXT_LENGTH, pad_id=PAD_ID)
    tokenizer.enable_truncation(CONTEXT_LENGTH)
    session = ort.InferenceSession(
        str(_fetch(manifest, "text")), providers=["CPUExecutionProvider"]
    )
    encoded = tokenizer.encode_batch(texts)
    ids = np.array([item.ids for item in encoded], dtype=np.int64)
    output: np.ndarray = session.run(["text_embeds"], {"input_ids": ids})[0]
    return normalize_rows(output)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    labels, texts = sentences(yaml.safe_load(PROMPTS_YAML.read_text(encoding="utf-8")))
    embeddings = _embed(texts, manifest)
    np.savez(BANK_FILE, labels=np.array(labels), embeddings=embeddings)
    print(f"{len(texts)} cumle, {embeddings.shape[1]} boyut -> {BANK_FILE}")


if __name__ == "__main__":
    main()
