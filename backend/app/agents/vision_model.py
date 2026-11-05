"""Vision Agent'in modeli: CLIP goruntu kodlayicisi (ONNX, int8) ve istem bankasi.

Model dosyasi (89 MB) repoda degil: Docker imaji kurulurken manifest.json'daki sabit surumden
indirilir ve SHA-256 ile dogrulanir (Dockerfile). Dosya ya da onnxruntime yoksa (CI, ilk kurulum)
None doner: fotograf onerisi kapanir, sistemin geri kalani etkilenmez.

Bellek: oturum ~180 MB. Ilk fotografta yuklenir (lru_cache), Render'in 512 MB sinirinda uygulama
acilisi etkilenmez.
"""

import json
import logging
import warnings
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any, Protocol

import numpy as np
from PIL import Image, ImageOps

from app.agents.vision import PromptBank

VISION_DIR = Path(__file__).resolve().parents[2] / "ml_models" / "vision" / "v1"
BANK_FILE = "prompts.npz"
MANIFEST_FILE = "manifest.json"
INPUT_NAME = "pixel_values"
MAX_CHANNEL_VALUE = 255.0
# JPEG cozulurken hedefin bu kati boyutta acilir (draft): 12 MP fotograf bellegi sisirmez
DRAFT_FACTOR = 2

logger = logging.getLogger(__name__)


class ImageEncoder(Protocol):
    def encode(self, data: bytes) -> list[float]: ...


@dataclass(frozen=True)
class VisionModel:
    encoder: ImageEncoder
    bank: PromptBank


def to_pixels(data: bytes, manifest: dict[str, Any]) -> np.ndarray:
    """CLIP on islemi: kisa kenar 224'e (bicubic), ortadan kare kesim, kanal bazli normalize."""
    size = int(manifest["image_size"])
    with warnings.catch_warnings():
        # Sikistirma bombasi uyarisi da hata sayilir (image_policy ile ayni kural)
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(BytesIO(data)) as source:
            source.draft("RGB", (size * DRAFT_FACTOR, size * DRAFT_FACTOR))
            image = ImageOps.exif_transpose(source).convert("RGB")
    scale = size / min(image.size)
    width, height = (max(size, round(side * scale)) for side in image.size)
    image = image.resize((width, height), Image.Resampling.BICUBIC)
    left, top = (width - size) // 2, (height - size) // 2
    image = image.crop((left, top, left + size, top + size))
    mean = np.asarray(manifest["image_mean"], dtype=np.float32)
    std = np.asarray(manifest["image_std"], dtype=np.float32)
    pixels = (np.asarray(image, dtype=np.float32) / MAX_CHANNEL_VALUE - mean) / std
    return pixels.transpose(2, 0, 1)[np.newaxis]


class OnnxImageEncoder:
    def __init__(self, session: Any, manifest: dict[str, Any]) -> None:
        self._session = session
        self._manifest = manifest

    def encode(self, data: bytes) -> list[float]:
        output = self._session.run(None, {INPUT_NAME: to_pixels(data, self._manifest)})
        embedding: list[float] = output[0][0].tolist()
        return embedding


def load_bank(directory: Path) -> PromptBank:
    with np.load(directory / BANK_FILE, allow_pickle=False) as bank:
        return PromptBank(
            labels=tuple(str(label) for label in bank["labels"]),
            embeddings=bank["embeddings"].astype(np.float32),
        )


def load_vision(model_path: Path, directory: Path = VISION_DIR) -> VisionModel | None:
    if not model_path.exists():
        logger.warning("Goruntu modeli yok (%s); fotograf onerisi kapali", model_path)
        return None
    try:
        import onnxruntime as ort
    except ImportError:
        logger.warning("onnxruntime kurulu degil; fotograf onerisi kapali")
        return None
    options = ort.SessionOptions()
    # Tek is parcacigi ve bellek havuzu kapali: ucretsiz sunucunun 512 MB'ina sigar (~40 ms/foto)
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.enable_cpu_mem_arena = False
    session = ort.InferenceSession(str(model_path), options, providers=["CPUExecutionProvider"])
    manifest = json.loads((directory / MANIFEST_FILE).read_text(encoding="utf-8"))
    return VisionModel(encoder=OnnxImageEncoder(session, manifest), bank=load_bank(directory))


@lru_cache(maxsize=1)
def get_vision(model_path: str) -> VisionModel | None:
    """Uygulama boyunca tek kopya; ilk fotografta yuklenir."""
    return load_vision(Path(model_path))
