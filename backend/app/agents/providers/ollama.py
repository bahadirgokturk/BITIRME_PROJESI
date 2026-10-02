"""Yerel LLM istemcisi (Ollama, opsiyonel K3, docs/AGENTS.md 4.10). Ucretli API yok.

Yalniz yonetim ozetinin sablon metnini akicilastirir. Ciktiyi Analytics Summary Agent sayi ve
nedensellik korumasindan gecirir. Ek bagimlilik yok (standart kutuphane HTTP istemcisi).
"""

import json
import urllib.error
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from app.agents.analytics_summary import PolisherUnavailableError, TextPolisher
from app.core.config import LlmProvider, Settings

# Kucuk yerel model CPU'da birkac saniye surer; daha uzunsa sablon metin yeterli
TIMEOUT_SECONDS = 20
_ALLOWED_SCHEMES = frozenset({"http", "https"})
PROMPT = (
    "Aşağıdaki yönetim özetini Türkçe, akıcı ve kısa bir paragraf olarak yeniden yaz.\n"
    "Kurallar: Yeni sayı ekleme, sayıları değiştirme. Neden-sonuç kurma ('çünkü', 'nedeniyle' "
    "kullanma); gerekirse 'ilişkili olabilir' de. Yalnız paragrafı yaz.\n\n"
    "Özet:\n{text}\n\nVeri (JSON):\n{data}\n"
)


class OllamaPolisher:
    def __init__(self, url: str, model: str) -> None:
        # Adres ayardan gelir; yine de dosya/ozel semalar acilmasin
        if urlparse(url).scheme not in _ALLOWED_SCHEMES:
            raise ValueError("OLLAMA_URL http ya da https olmalı")
        self._url = url.rstrip("/")
        self._model = model

    def polish(self, text: str, data: dict[str, object]) -> str:
        prompt = PROMPT.format(text=text, data=json.dumps(data, ensure_ascii=False))
        body = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0},
        }
        request = Request(  # noqa: S310 - sema yukarida http/https ile sinirli
            f"{self._url}/api/generate",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
                payload = json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise PolisherUnavailableError(str(exc)) from exc
        answer = payload.get("response") if isinstance(payload, dict) else None
        if not isinstance(answer, str) or not answer.strip():
            raise PolisherUnavailableError("Yerel model boş ya da geçersiz yanıt verdi")
        return answer.strip()


def summary_polisher(settings: Settings) -> TextPolisher | None:
    """LLM_PROVIDER=none (varsayilan) ise yalniz sablon kullanilir."""
    if settings.llm_provider is LlmProvider.OLLAMA:
        return OllamaPolisher(settings.ollama_url, settings.ollama_model)
    return None
