from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentPolicy
from app.models.enums import PolicyScope


def get_for_case_type(
    session: Session, organization_id: int, case_type_id: int
) -> AgentPolicy | None:
    return session.scalars(
        select(AgentPolicy).where(
            AgentPolicy.organization_id == organization_id,
            AgentPolicy.scope == PolicyScope.CASE_TYPE,
            AgentPolicy.case_type_id == case_type_id,
        )
    ).one_or_none()


def add(session: Session, policy: AgentPolicy) -> AgentPolicy:
    session.add(policy)
    session.flush()
    return policy
