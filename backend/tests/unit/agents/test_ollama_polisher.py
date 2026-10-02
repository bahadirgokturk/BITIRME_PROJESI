"""Yerel LLM istemcisi (Ollama, opsiyonel K3). Ag cagrisi taklit edilir; gercek model gerekmez."""

import json
import urllib.error
from io import BytesIO
from typing import Any

import pytest

from app.agents.analytics_summary import PolisherUnavailableError
from app.agents.providers import ollama
from app.agents.providers.ollama import OllamaPolisher, summary_polisher
from app.core.config import Settings

URL = "http://ollama.local:11434"


class _Response(BytesIO):
    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _fake_urlopen(answer: object, sent: list[Any]) -> Any:
    def urlopen(request: Any, timeout: float) -> _Response:
        sent.append((request, timeout))
        return _Response(json.dumps(answer).encode())

    return urlopen


def test_the_template_and_data_are_sent_and_the_answer_returned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: list[Any] = []
    monkeypatch.setattr(ollama, "urlopen", _fake_urlopen({"response": "  Akıcı metin.  "}, sent))

    answer = OllamaPolisher(URL, "qwen2.5:3b").polish("Şablon metin.", {"total_cases": 186})

    assert answer == "Akıcı metin."
    request, timeout = sent[0]
    body = json.loads(request.data)
    assert request.full_url == f"{URL}/api/generate"
    assert (body["model"], body["stream"], body["options"]["temperature"]) == (
        "qwen2.5:3b",
        False,
        0,
    )
    assert "Şablon metin." in body["prompt"] and "186" in body["prompt"]
    assert timeout > 0


@pytest.mark.parametrize(
    "failure",
    [urllib.error.URLError("refused"), TimeoutError()],
)
def test_an_unreachable_model_is_reported(
    monkeypatch: pytest.MonkeyPatch, failure: Exception
) -> None:
    def urlopen(*_: object, **__: object) -> None:
        raise failure

    monkeypatch.setattr(ollama, "urlopen", urlopen)

    with pytest.raises(PolisherUnavailableError):
        OllamaPolisher(URL, "m").polish("t", {})


@pytest.mark.parametrize("answer", [{"response": "   "}, {"error": "model yok"}])
def test_an_empty_or_invalid_answer_is_reported(
    monkeypatch: pytest.MonkeyPatch, answer: object
) -> None:
    monkeypatch.setattr(ollama, "urlopen", _fake_urlopen(answer, []))

    with pytest.raises(PolisherUnavailableError):
        OllamaPolisher(URL, "m").polish("t", {})


def test_only_http_urls_are_accepted() -> None:
    with pytest.raises(ValueError, match="http"):
        OllamaPolisher("file:///etc/passwd", "m")


def _settings(**changes: object) -> Settings:
    base = {"database_url": "postgresql+psycopg://u:p@localhost:5432/db", "jwt_secret": "x" * 48}
    return Settings(**base, **changes)  # type: ignore[arg-type]


def test_without_a_provider_there_is_no_polisher() -> None:
    assert summary_polisher(_settings()) is None


def test_ollama_provider_builds_the_client() -> None:
    polisher = summary_polisher(_settings(llm_provider="ollama", ollama_url=URL))

    assert isinstance(polisher, OllamaPolisher)
