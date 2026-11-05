"""Agent kararlarindan ortak alt sorgular."""

from sqlalchemy import Subquery, select
from sqlalchemy.dialects.postgresql import distinct_on

from app.models import AgentDecision


def latest_decisions(agent_name: str) -> Subquery:
    """Her bildirim icin agent'in son karari (yeniden analizde onceki karar gecersiz kalir)."""
    return (
        select(AgentDecision.case_id, AgentDecision.decision)
        .where(AgentDecision.agent_name == agent_name)
        .ext(distinct_on(AgentDecision.case_id))
        .order_by(AgentDecision.case_id, AgentDecision.created_at.desc(), AgentDecision.id.desc())
        .subquery()
    )
