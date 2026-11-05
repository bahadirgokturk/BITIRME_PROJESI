"""WorkflowService.transition yan etkileri: olay kaydi, zaman damgalari, reopen sayaci."""

from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import InvalidTransitionError
from app.models import Case, CaseEvent
from app.models.enums import ActorType, CaseEventType, CaseStatus
from app.services.workflow import Transition, WorkflowService
from tests.integration.conftest import FrozenClock
from tests.integration.factories import make_location, make_organization, make_user

SYSTEM = Transition(event_type=CaseEventType.ANALYSIS_STARTED, actor_type=ActorType.SYSTEM)


@pytest.fixture
def case(db_session: Session) -> Case:
    organization = make_organization(db_session)
    reporter = make_user(db_session, organization=organization)
    location = make_location(db_session, organization)
    record = Case(
        organization_id=organization.id,
        case_number="CASE-TEST01",
        title="Sabun bitti",
        description="Tuvalette sabun bitmis.",
        reporter_id=reporter.id,
        location_id=location.id,
        status=CaseStatus.NEW,
    )
    db_session.add(record)
    db_session.flush()
    return record


@pytest.fixture
def workflow(db_session: Session, clock: FrozenClock) -> WorkflowService:
    return WorkflowService(db_session, clock)


def _events(session: Session, case: Case) -> list[CaseEvent]:
    statement = select(CaseEvent).where(CaseEvent.case_id == case.id).order_by(CaseEvent.id)
    return list(session.scalars(statement))


def _walk(workflow: WorkflowService, case: Case, *statuses: CaseStatus) -> None:
    for status in statuses:
        workflow.transition(case, status, SYSTEM)


def test_transition_writes_an_event(
    db_session: Session, workflow: WorkflowService, case: Case, clock: FrozenClock
) -> None:
    workflow.transition(case, CaseStatus.ANALYZING, SYSTEM)

    [event] = _events(db_session, case)
    assert case.status is CaseStatus.ANALYZING
    assert (event.from_status, event.to_status) == (CaseStatus.NEW, CaseStatus.ANALYZING)
    assert event.event_type == "ANALYSIS_STARTED"
    assert event.occurred_at == clock.now()


def test_invalid_transition_changes_nothing(
    db_session: Session, workflow: WorkflowService, case: Case
) -> None:
    with pytest.raises(InvalidTransitionError):
        workflow.transition(case, CaseStatus.CLOSED, SYSTEM)

    assert case.status is CaseStatus.NEW
    assert _events(db_session, case) == []


def test_first_assignment_time_is_kept_on_reassignment(
    workflow: WorkflowService, case: Case, clock: FrozenClock
) -> None:
    _walk(workflow, case, CaseStatus.ANALYZING, CaseStatus.CLASSIFIED, CaseStatus.ASSIGNED)
    first_assigned = case.assigned_at
    clock.advance(timedelta(hours=1))

    workflow.transition(case, CaseStatus.ASSIGNED, SYSTEM)

    assert case.assigned_at == first_assigned


def test_reopen_counts_and_resolution_time_is_refreshed(
    workflow: WorkflowService, case: Case, clock: FrozenClock
) -> None:
    _walk(
        workflow,
        case,
        CaseStatus.ANALYZING,
        CaseStatus.CLASSIFIED,
        CaseStatus.ASSIGNED,
        CaseStatus.ACCEPTED,
        CaseStatus.IN_PROGRESS,
        CaseStatus.RESOLVED,
    )
    first_resolved = case.resolved_at
    _walk(workflow, case, CaseStatus.VERIFICATION, CaseStatus.CLOSED, CaseStatus.REOPENED)
    clock.advance(timedelta(hours=2))

    _walk(
        workflow,
        case,
        CaseStatus.ASSIGNED,
        CaseStatus.ACCEPTED,
        CaseStatus.IN_PROGRESS,
        CaseStatus.RESOLVED,
    )

    assert case.reopened_count == 1
    assert case.resolved_at is not None and first_resolved is not None
    assert case.resolved_at > first_resolved
    assert case.accepted_at is not None and case.started_at is not None
    assert case.closed_at is not None


def test_every_step_is_logged_in_order(
    db_session: Session, workflow: WorkflowService, case: Case
) -> None:
    _walk(workflow, case, CaseStatus.ANALYZING, CaseStatus.NEEDS_INFO, CaseStatus.ANALYZING)

    steps = [(e.from_status, e.to_status) for e in _events(db_session, case)]

    assert steps == [
        (CaseStatus.NEW, CaseStatus.ANALYZING),
        (CaseStatus.ANALYZING, CaseStatus.NEEDS_INFO),
        (CaseStatus.NEEDS_INFO, CaseStatus.ANALYZING),
    ]
