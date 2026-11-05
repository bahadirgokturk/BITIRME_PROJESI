import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.base import AgentResult
from app.models import AgentDecision

# numeric(4,3): 0.000-1.000
CONFIDENCE_DIGITS = 3


@dataclass(frozen=True)
class DecisionRun:
    """Bir pipeline kosusu: ayni kosunun kararlari ayni run_id ve zamanla yazilir."""

    case_id: int
    run_id: uuid.UUID
    at: datetime


def record(
    session: Session, run: DecisionRun, inp: BaseModel, result: AgentResult[BaseModel]
) -> AgentDecision:
    confidence = result.confidence
    decision = AgentDecision(
        case_id=run.case_id,
        run_id=run.run_id,
        agent_name=result.agent_name,
        decision=result.decision,
        confidence=None if confidence is None else round(Decimal(confidence), CONFIDENCE_DIGITS),
        reason_json=[reason.model_dump(mode="json") for reason in result.reasons],
        input_snapshot=inp.model_dump(mode="json"),
        output_json=result.output.model_dump(mode="json"),
        model=result.model,
        latency_ms=result.latency_ms,
        created_at=run.at,
    )
    session.add(decision)
    session.flush()
    return decision


def count(session: Session, case_id: int, agent_name: str, decision: str) -> int:
    statement = select(func.count()).where(
        AgentDecision.case_id == case_id,
        AgentDecision.agent_name == agent_name,
        AgentDecision.decision == decision,
    )
    return session.scalar(statement) or 0


def list_for_case(session: Session, case_id: int) -> Sequence[AgentDecision]:
    return session.scalars(
        select(AgentDecision)
        .where(AgentDecision.case_id == case_id)
        .order_by(AgentDecision.created_at, AgentDecision.id)
    ).all()
