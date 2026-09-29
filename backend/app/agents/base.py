"""Ortak agent sozlesmesi (docs/AGENTS.md bolum 2).

Agent'lar veritabanina ERISMEZ: girdiyi ve salt okunur AgentContext'i servis katmani hazirlar,
agent yalniz AgentResult dondurur. Sonuc girdisiyle birlikte agent_decisions'a yazilir
(karar tekrar uretilebilir).
"""

import time
from collections.abc import Callable
from datetime import datetime
from typing import Any, ClassVar, Protocol

from pydantic import BaseModel, ConfigDict, Field

MS_PER_SECOND = 1000
RULES_MODEL = "rules@1.0"


class Reason(BaseModel):
    """Kararin bir gerekcesi. message kullaniciya/manager'a gosterilir (Turkce)."""

    model_config = ConfigDict(frozen=True)

    code: str
    message: str
    weight: float | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class AgentResult[TOut: BaseModel](BaseModel):
    agent_name: str
    # Kisa karar kodu: "SOAP_EMPTY", "AUTO_ASSIGN", "TOO_SHORT"...
    decision: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    reasons: list[Reason]
    output: TOut
    # Hangi mantik: "rules@1.0", "tfidf-logreg@2026.10.1"
    model: str
    latency_ms: int = Field(ge=0)


class AgentContext(BaseModel):
    """Salt okunur ortam bilgisi. Agent'lar arasi ortak; gerekli alanlar ilgili PR'larda eklenir."""

    model_config = ConfigDict(frozen=True)

    now: datetime


class Agent[TIn, TOut: BaseModel](Protocol):
    name: ClassVar[str]
    version: ClassVar[str]

    def run(self, inp: TIn, ctx: AgentContext) -> AgentResult[TOut]: ...


def timed[T](work: Callable[[], T]) -> tuple[T, int]:
    """Isi calistirir ve suresini milisaniye olarak dondurur (agent gecikme metrigi)."""
    started = time.perf_counter()
    value = work()
    return value, int((time.perf_counter() - started) * MS_PER_SECOND)
