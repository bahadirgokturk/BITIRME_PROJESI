from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AgentPolicy
from app.models.enums import PolicyScope
from app.schemas.common import PageParams


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


def list_page(
    session: Session, organization_id: int, paging: PageParams
) -> tuple[Sequence[AgentPolicy], int]:
    scope = select(AgentPolicy).where(AgentPolicy.organization_id == organization_id)
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(AgentPolicy.id).offset(paging.offset).limit(paging.page_size)
    ).all()
    return items, total


def get(session: Session, policy_id: int) -> AgentPolicy | None:
    return session.get(AgentPolicy, policy_id)
