from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SlaRule
from app.models.enums import Priority


def active_rules(session: Session, organization_id: int) -> Sequence[SlaRule]:
    return session.scalars(
        select(SlaRule).where(
            SlaRule.organization_id == organization_id, SlaRule.is_active.is_(True)
        )
    ).all()


def get_rule(
    session: Session, organization_id: int, case_type_id: int | None, priority: Priority
) -> SlaRule | None:
    type_filter = (
        SlaRule.case_type_id.is_(None)
        if case_type_id is None
        else SlaRule.case_type_id == case_type_id
    )
    return session.scalars(
        select(SlaRule).where(
            SlaRule.organization_id == organization_id, type_filter, SlaRule.priority == priority
        )
    ).one_or_none()


def add(session: Session, rule: SlaRule) -> SlaRule:
    session.add(rule)
    session.flush()
    return rule
