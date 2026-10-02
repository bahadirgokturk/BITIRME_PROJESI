"""Agent kararlari (docs/DATABASE.md "agent_decisions"): her karar girdisi ve gerekcesiyle saklanir.

Ayni pipeline kosusunun kararlari run_id ile gruplanir. Kayit append-only'dir; manager duzeltmesi
ayri tabloda tutulur (decision_feedback, E5-9). Girdi saklandigi icin karar tekrar uretilebilir.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin
from app.models.case import SCORE


class AgentDecision(IdMixin, Base):
    __tablename__ = "agent_decisions"
    __table_args__ = (Index("ix_agent_decisions_case_id_created_at", "case_id", "created_at"),)

    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"))
    run_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    agent_name: Mapped[str] = mapped_column(String(50))
    # Kisa karar kodu: "SOAP_EMPTY", "HIGH", "AUTO_ASSIGN"
    decision: Mapped[str] = mapped_column(String(50))
    confidence: Mapped[Decimal | None] = mapped_column(SCORE)
    # Gerekceler (Reason listesi), agent'a verilen girdi ve tam cikti
    reason_json: Mapped[list[Any]] = mapped_column(JSONB)
    input_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    output_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # "tfidf-logreg@1.0", "rules@1.0"
    model: Mapped[str] = mapped_column(String(100))
    latency_ms: Mapped[int] = mapped_column(Integer)
    # Uygulama saati (Clock) yazilir; testte dondurulabilir
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
