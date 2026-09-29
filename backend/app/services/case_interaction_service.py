"""Yorum, geri bildirim ve yeniden acma (E3-5). Yetki tablosu: docs/WORKFLOW.md bolum 4.

Once bildirimi gorme kurali (yoksa 404), sonra islemin rol kurali (yoksa 403):
- Herkese acik yorum: ADMIN disinda bildirimi goren herkes.
- Ic not: yalniz STAFF ve MANAGER yazar ve gorur.
- Puan: yalniz bildirim yapan, kapanmis bildirimde, kapanistan 72 saat icinde, bir kez.
- Yeniden acma: bildirim yapan (kapanmissa 72 saat icinde) ya da MANAGER (her zaman).
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.core import messages
from app.core.clock import Clock
from app.core.constants import REOPEN_WINDOW_HOURS
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ReopenWindowClosedError
from app.models import Case, Comment, User
from app.models.enums import ActorType, CaseEventType, CaseStatus, UserRole
from app.repositories import case_repository, comment_repository
from app.schemas.case import (
    CaseRead,
    CommentCreate,
    CommentRead,
    FeedbackCreate,
    ReopenRequest,
)
from app.services.authorization import ensure_can_view_case
from app.services.workflow import Transition, WorkflowService

_INTERNAL_NOTE_ROLES = frozenset({UserRole.STAFF, UserRole.MANAGER})
_REOPEN_WINDOW = timedelta(hours=REOPEN_WINDOW_HOURS)


class CaseInteractionService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock
        self._workflow = WorkflowService(session, clock)

    def add_comment(self, case_id: int, data: CommentCreate) -> CommentRead:
        case = self._visible_case(case_id)
        if self._actor.role is UserRole.ADMIN:
            raise ForbiddenError()
        if data.is_internal and self._actor.role not in _INTERNAL_NOTE_ROLES:
            raise ForbiddenError()
        comment = comment_repository.add(
            self._session,
            Comment(
                case_id=case.id,
                author_id=self._actor.id,
                body=data.body,
                is_internal=data.is_internal,
                created_at=self._clock.now(),
            ),
        )
        # Olay kaydinda yorum metni yok: zaman cizelgesi ic notu sizdirmasin
        added = Transition(
            event_type=CaseEventType.COMMENT_ADDED,
            actor_type=ActorType.USER,
            actor_id=self._actor.id,
            metadata={"comment_id": comment.id, "is_internal": data.is_internal},
        )
        self._workflow.record(case, added, self._clock.now())
        self._session.commit()
        return _comment_read(comment_repository.get_with_author(self._session, comment.id))

    def comments(self, case_id: int) -> list[CommentRead]:
        case = self._visible_case(case_id)
        include_internal = self._actor.role in _INTERNAL_NOTE_ROLES
        items = comment_repository.list_for_case(
            self._session, case.id, include_internal=include_internal
        )
        return [_comment_read(item) for item in items]

    def feedback(self, case_id: int, data: FeedbackCreate) -> CaseRead:
        case = self._owned_case(case_id)
        if case.status is not CaseStatus.CLOSED:
            raise ConflictError(messages.CASE_NOT_CLOSED)
        if case.satisfaction_rating is not None:
            raise ConflictError(messages.ALREADY_RATED)
        if not self._within_window(case):
            raise ConflictError(messages.RATING_WINDOW_CLOSED.format(hours=REOPEN_WINDOW_HOURS))
        case.satisfaction_rating = data.rating
        case.satisfaction_comment = data.comment
        submitted = Transition(
            event_type=CaseEventType.FEEDBACK_SUBMITTED,
            actor_type=ActorType.USER,
            actor_id=self._actor.id,
            metadata={"rating": data.rating},
        )
        self._workflow.record(case, submitted, self._clock.now())
        return self._commit_and_read(case)

    def reopen(self, case_id: int, data: ReopenRequest) -> CaseRead:
        case = self._visible_case(case_id)
        is_manager = self._actor.role is UserRole.MANAGER
        if not is_manager and case.reporter_id != self._actor.id:
            raise ForbiddenError()
        if not is_manager and not self._within_window(case):
            raise ReopenWindowClosedError(REOPEN_WINDOW_HOURS)
        reopened = Transition(
            event_type=CaseEventType.CASE_REOPENED,
            actor_type=ActorType.USER,
            actor_id=self._actor.id,
            metadata={"reason": data.reason},
        )
        self._workflow.transition(case, CaseStatus.REOPENED, reopened)
        return self._commit_and_read(case)

    def _within_window(self, case: Case) -> bool:
        """Kapanmamis bildirimde pencere acik sayilir; gecisin gecerliligini is akisi denetler."""
        if case.status is not CaseStatus.CLOSED or case.closed_at is None:
            return True
        return self._clock.now() - case.closed_at <= _REOPEN_WINDOW

    def _owned_case(self, case_id: int) -> Case:
        case = self._visible_case(case_id)
        if case.reporter_id != self._actor.id:
            raise ForbiddenError()
        return case

    def _visible_case(self, case_id: int) -> Case:
        case = case_repository.get(self._session, case_id)
        if case is None:
            raise NotFoundError()
        ensure_can_view_case(self._actor, case)
        return case

    def _commit_and_read(self, case: Case) -> CaseRead:
        self._session.commit()
        refreshed = case_repository.get(self._session, case.id)
        return CaseRead.model_validate(refreshed, from_attributes=True)


def _comment_read(comment: Comment) -> CommentRead:
    return CommentRead(
        id=comment.id,
        case_id=comment.case_id,
        body=comment.body,
        is_internal=comment.is_internal,
        author_id=comment.author_id,
        author_name=comment.author.full_name,
        author_role=comment.author.role,
        created_at=comment.created_at,
    )
