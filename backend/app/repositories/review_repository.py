"""Manager inceleme kuyrugu sorgulari (E5-9)."""

from collections.abc import Sequence

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case
from app.models.enums import CaseStatus
from app.repositories.case_repository import WITH_SUMMARIES
from app.schemas.common import PageParams

SUPERVISOR = "supervisor"
RESOLUTION = "resolution"
# Kuyruk satirindaki "neden buraya dustu" gerekcesini veren agent'lar
_EXPLAINING_AGENTS = (SUPERVISOR, RESOLUTION)


def _waiting(organization_id: int) -> Select[Case]:
    # ESCALATED: manager karar kuyrugu (agent yukseltti ya da personel reddetti);
    # CLASSIFIED / VERIFICATION + needs_human_review: agent emin olamadi (siniflandirma ya da
    # tamamlanan isin dogrulamasi)
    return select(Case).where(
        Case.organization_id == organization_id,
        or_(
            Case.status == CaseStatus.ESCALATED,
            and_(
                Case.status.in_((CaseStatus.CLASSIFIED, CaseStatus.VERIFICATION)),
                Case.needs_human_review.is_(True),
            ),
        ),
    )


def queue_page(
    session: Session, organization_id: int, paging: PageParams
) -> tuple[Sequence[Case], int]:
    total = session.scalar(select(func.count()).select_from(_waiting(organization_id).subquery()))
    items = session.scalars(
        _waiting(organization_id)
        .options(*WITH_SUMMARIES)
        # Enum sirasi LOW < MEDIUM < HIGH < CRITICAL: en kritik ve en eski once
        .order_by(Case.priority.desc().nulls_last(), Case.created_at, Case.id)
        .offset(paging.offset)
        .limit(paging.page_size)
    ).all()
    return items, total or 0


def latest_explanation(session: Session, case_id: int) -> AgentDecision | None:
    """Bildirimi manager'a birakan son karar (Supervisor ya da Resolution)."""
    return session.scalars(
        select(AgentDecision)
        .where(AgentDecision.case_id == case_id, AgentDecision.agent_name.in_(_EXPLAINING_AGENTS))
        .order_by(AgentDecision.created_at.desc(), AgentDecision.id.desc())
        .limit(1)
    ).one_or_none()


def latest_decision(session: Session, case_id: int, agent_name: str) -> AgentDecision | None:
    return session.scalars(
        select(AgentDecision)
        .where(AgentDecision.case_id == case_id, AgentDecision.agent_name == agent_name)
        .order_by(AgentDecision.created_at.desc(), AgentDecision.id.desc())
        .limit(1)
    ).one_or_none()
