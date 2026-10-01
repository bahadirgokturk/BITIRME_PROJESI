"""Bildirim olusturma ve gorme (E3-1). Durum degisiklikleri WorkflowService uzerinden gecer.

Yeni bildirim NEW olarak kaydedilir ve hemen ANALYZING'e gecer; agent hatti (FAZ 5) buradan
devam eder. Tur, birim ve oncelik kullanicidan alinmaz.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.constants import (
    CASE_NUMBER_DIGITS,
    CASE_NUMBER_PREFIX,
    CASE_TITLE_FROM_DESCRIPTION_LENGTH,
)
from app.core.errors import NotFoundError
from app.models import Case, CaseEvent, User
from app.models.enums import ActorType, CaseEventType, CaseStatus, UserRole
from app.repositories import case_repository, location_repository
from app.repositories.case_repository import CaseScope
from app.schemas.case import CaseCreate, CaseEventRead, CaseRead
from app.schemas.common import Page, PageParams
from app.services.authorization import ensure_can_view_case, ensure_same_organization
from app.services.case_view import case_read
from app.services.workflow import Transition, WorkflowService

# Bildirim yapanin zaman cizelgesinde gordugu olaylar; agent kararlari, ic yorumlar ve SLA
# uyarilari yalniz yetkililere gorunur (docs/API.md "/cases/{id}/events")
REPORTER_VISIBLE_EVENTS = frozenset(
    {
        CaseEventType.CASE_CREATED,
        CaseEventType.ANALYSIS_STARTED,
        # "Incelendi" ve "birime yonlendirildi": adim gorunur, karar ayrintisi (metadata) gizli
        CaseEventType.AI_CLASSIFIED,
        CaseEventType.ROUTED,
        CaseEventType.INFO_REQUESTED,
        CaseEventType.INFO_PROVIDED,
        CaseEventType.CASE_MERGED,
        CaseEventType.TASK_CREATED,
        CaseEventType.WORK_STARTED,
        CaseEventType.WORK_COMPLETED,
        CaseEventType.CASE_CLOSED,
        CaseEventType.CASE_REOPENED,
        CaseEventType.CASE_REJECTED,
        CaseEventType.FEEDBACK_SUBMITTED,
    }
)

# Kisaltilmis basligin sonunda kalmamasi gereken karakterler
_TITLE_TRAILING = " ,;:.-"
_ELLIPSIS = "…"

_ANALYSIS_STARTED = Transition(
    event_type=CaseEventType.ANALYSIS_STARTED, actor_type=ActorType.SYSTEM
)


def scope_for(user: User) -> CaseScope:
    """Liste kapsami; tekil kayit icin ayni kural services/authorization.py can_view_case."""
    if user.role in {UserRole.MANAGER, UserRole.ADMIN}:
        return CaseScope(organization_id=user.organization_id)
    if user.role is UserRole.STAFF:
        return CaseScope(
            organization_id=user.organization_id,
            reporter_id=user.id,
            department_id=user.department_id,
            assigned_staff_id=user.id,
        )
    return CaseScope(organization_id=user.organization_id, reporter_id=user.id)


def title_from(description: str) -> str:
    """Bos baslik icin aciklamanin basi; kelime ortasindan kesilmez, kisaltilinca ... eklenir."""
    text = " ".join(description.split())
    if len(text) <= CASE_TITLE_FROM_DESCRIPTION_LENGTH:
        return text
    # Bir sonraki karakter de alinir: tam sinirda bosluk varsa son kelime butun kalir
    window = text[: CASE_TITLE_FROM_DESCRIPTION_LENGTH + 1]
    head = window.rsplit(" ", 1)[0] if " " in window else text[:CASE_TITLE_FROM_DESCRIPTION_LENGTH]
    return head.rstrip(_TITLE_TRAILING) + _ELLIPSIS


class CaseService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock
        self._workflow = WorkflowService(session, clock)

    def create(self, data: CaseCreate) -> CaseRead:
        self._ensure_active_location(data.location_id)
        number = case_repository.next_case_number(self._session)
        case = case_repository.add(
            self._session,
            Case(
                organization_id=self._actor.organization_id,
                case_number=f"{CASE_NUMBER_PREFIX}{number:0{CASE_NUMBER_DIGITS}d}",
                title=data.title or title_from(data.description),
                description=data.description,
                reporter_id=self._actor.id,
                location_id=data.location_id,
                status=CaseStatus.NEW,
                created_at=self._clock.now(),
            ),
        )
        created = Transition(
            event_type=CaseEventType.CASE_CREATED,
            actor_type=ActorType.USER,
            actor_id=self._actor.id,
        )
        self._workflow.record(case, created, self._clock.now())
        self._workflow.transition(case, CaseStatus.ANALYZING, _ANALYSIS_STARTED)
        self._session.commit()
        return self.get(case.id)

    def search(self, statuses: Sequence[CaseStatus], paging: PageParams) -> Page[CaseRead]:
        return self._page(scope_for(self._actor), statuses, paging)

    def list_mine(self, paging: PageParams) -> Page[CaseRead]:
        scope = CaseScope(organization_id=self._actor.organization_id, reporter_id=self._actor.id)
        return self._page(scope, (), paging)

    def get(self, case_id: int) -> CaseRead:
        return case_read(self._get(case_id), self._clock.now())

    def events(self, case_id: int) -> list[CaseEventRead]:
        case = self._get(case_id)
        events = case_repository.list_events(self._session, case.id)
        if self._actor.role is UserRole.REPORTER:
            return [
                _public(event) for event in events if event.event_type in REPORTER_VISIBLE_EVENTS
            ]
        return [CaseEventRead.model_validate(event, from_attributes=True) for event in events]

    def _page(
        self, scope: CaseScope, statuses: Sequence[CaseStatus], paging: PageParams
    ) -> Page[CaseRead]:
        items, total = case_repository.list_page(self._session, scope, statuses, paging)
        return Page(
            items=[case_read(c, self._clock.now()) for c in items],
            total=total,
            page=paging.page,
        )

    def _get(self, case_id: int) -> Case:
        case = case_repository.get(self._session, case_id)
        if case is None:
            raise NotFoundError()
        ensure_can_view_case(self._actor, case)
        return case

    def _ensure_active_location(self, location_id: int) -> None:
        location = location_repository.get(self._session, location_id)
        if location is None or not location.is_active:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=location.organization_id)


def _public(event: CaseEvent) -> CaseEventRead:
    # Bildirim yapan olay ayrintisini (karar kimlikleri, skorlar) gormez
    read = CaseEventRead.model_validate(event, from_attributes=True)
    return read.model_copy(update={"metadata": {}})
