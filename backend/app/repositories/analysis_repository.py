"""Agent hattinin ihtiyac duydugu sorgular (E5-8b).

Agent'lar DB'ye dokunmaz; sayilari servis buradan okuyup girdi olarak verir.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Case, CaseEvent, CaseType, Comment, Location, Task, User
from app.models.enums import ActorType, CaseEventType, CaseStatus, TaskStatus, UserRole
from app.services.workflow import ACTIVE_TASK_STATUSES, MERGE_PARENT_STATUSES

PATH_SEPARATOR = "/"
# Materialized path: KMP/B/B-2/B-2-WCM -> ikinci parca bina kodu (Intake ile ayni kural)
BUILDING_SEGMENT = 1


@dataclass(frozen=True)
class StaffFacts:
    user_id: int
    open_task_count: int
    current_building: str | None
    recent_same_type_count: int


def building_code(path: str) -> str | None:
    segments = path.split(PATH_SEPARATOR)
    return segments[BUILDING_SEGMENT] if len(segments) > BUILDING_SEGMENT else None


def duplicate_candidates(session: Session, case: Case, since: datetime) -> Sequence[Case]:
    """Ayni sorunun daha once bildirilmis olabilecegi acik bildirimler (AGENTS.md 4.3):
    ayni kurum, ayni bina, `since` sonrasi, siniflandirilmis ve sorunu hala acik."""
    building = PATH_SEPARATOR.join(case.location.path.split(PATH_SEPARATOR)[: BUILDING_SEGMENT + 1])
    return session.scalars(
        select(Case)
        .join(Location, Case.location_id == Location.id)
        .where(
            Case.organization_id == case.organization_id,
            Case.id != case.id,
            Case.status.in_(MERGE_PARENT_STATUSES),
            Case.case_type_id.is_not(None),
            Case.created_at >= since,
            or_(
                Location.path == building,
                Location.path.startswith(building + PATH_SEPARATOR, autoescape=True),
            ),
        )
        .options(selectinload(Case.location), selectinload(Case.case_type))
        .order_by(Case.created_at, Case.id)
    ).all()


def active_case_types(session: Session, organization_id: int) -> Sequence[CaseType]:
    return session.scalars(
        select(CaseType)
        .where(CaseType.organization_id == organization_id, CaseType.is_active.is_(True))
        .order_by(CaseType.id)
    ).all()


def reporter_history(session: Session, case: Case) -> tuple[int, int]:
    """Bildirim yapanin onceki bildirim sayisi ve bunlarin kaci reddedilmis."""
    others = select(Case.status).where(Case.reporter_id == case.reporter_id, Case.id != case.id)
    statuses = session.scalars(others).all()
    return len(statuses), sum(status is CaseStatus.REJECTED for status in statuses)


def verified_before_here(session: Session, case: Case, case_type_id: int) -> bool:
    """Ayni yerde ayni tur daha once cozulup kapanmis mi (gercek bir sorun oldugu dogrulanmis)."""
    statement = select(func.count()).where(
        Case.location_id == case.location_id,
        Case.case_type_id == case_type_id,
        Case.status == CaseStatus.CLOSED,
        Case.id != case.id,
    )
    return (session.scalar(statement) or 0) > 0


def recent_similar_count(session: Session, case: Case, case_type_id: int, since: datetime) -> int:
    statement = select(func.count()).where(
        Case.location_id == case.location_id,
        Case.case_type_id == case_type_id,
        Case.created_at >= since,
        Case.id != case.id,
    )
    return session.scalar(statement) or 0


def staff_facts(
    session: Session, department_id: int, case_type_id: int, since: datetime
) -> list[StaffFacts]:
    staff = session.scalars(
        select(User)
        .where(
            User.department_id == department_id,
            User.role == UserRole.STAFF,
            User.is_active.is_(True),
        )
        .order_by(User.id)
    ).all()
    return [_facts(session, user.id, case_type_id, since) for user in staff]


def _facts(session: Session, user_id: int, case_type_id: int, since: datetime) -> StaffFacts:
    active = session.scalars(
        select(Task)
        .where(Task.assigned_user_id == user_id, Task.status.in_(ACTIVE_TASK_STATUSES))
        .options(selectinload(Task.case).selectinload(Case.location))
        .order_by(Task.created_at.desc(), Task.id.desc())
    ).all()
    experience = select(func.count()).select_from(Task).join(Case, Task.case_id == Case.id)
    experience = experience.where(
        Task.assigned_user_id == user_id,
        Task.status == TaskStatus.COMPLETED,
        Task.completed_at >= since,
        Case.case_type_id == case_type_id,
    )
    return StaffFacts(
        user_id=user_id,
        open_task_count=len(active),
        # Konum takibi yok: personelin bulundugu bina = en son aktif gorevinin binasi
        current_building=building_code(active[0].case.location.path) if active else None,
        recent_same_type_count=session.scalar(experience) or 0,
    )


def info_answers(session: Session, case_id: int) -> list[str]:
    """Bildirim yapanin ek bilgi yanitlari (INFO_PROVIDED olaylarinin isaret ettigi yorumlar)."""
    events = session.scalars(
        select(CaseEvent).where(
            CaseEvent.case_id == case_id, CaseEvent.event_type == CaseEventType.INFO_PROVIDED
        )
    ).all()
    ids = [event.metadata_json["comment_id"] for event in events]
    if not ids:
        return []
    return list(
        session.scalars(select(Comment.body).where(Comment.id.in_(ids)).order_by(Comment.id))
    )


def agent_info_requests(session: Session, case_id: int) -> int:
    """Agent'in bu bildirim icin daha once kac kez ek bilgi istedigi."""
    statement = select(func.count()).where(
        CaseEvent.case_id == case_id,
        CaseEvent.event_type == CaseEventType.INFO_REQUESTED,
        CaseEvent.actor_type == ActorType.AGENT,
    )
    return session.scalar(statement) or 0


def location(session: Session, location_id: int) -> Location | None:
    return session.get(Location, location_id)
