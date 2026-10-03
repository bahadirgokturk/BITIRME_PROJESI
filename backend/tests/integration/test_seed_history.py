"""Demo gecmisi (E6-1): bildirimler gercek agent hattindan ve personel akisindan gecmis gibi
uretilir.

Kucuk bir planla (10 gun) denenir; tam plan 60 gun. Gomulu oruntuler (RQ4) analitikte bulunmali.
"""

from datetime import UTC, datetime, timedelta
from statistics import median

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, CaseEvent, CaseType, Department, Location, Task
from app.models.enums import CaseStatus
from seeds.campus import seed_campus, seed_demo_users
from seeds.history import HistoryPlan, HistoryResult, seed_history

PASSWORD = "demo-parola-123"
END = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)
PLAN = HistoryPlan(end=END, days=10, base_reports_per_day=2.0)


@pytest.fixture
def history(db_session: Session) -> HistoryResult:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    return seed_history(db_session, organization, PASSWORD, PLAN)


def _cases(session: Session) -> list[Case]:
    return list(session.scalars(select(Case).order_by(Case.id)))


def test_cases_are_marked_as_seed_and_lie_in_the_window(
    db_session: Session, history: HistoryResult
) -> None:
    cases = _cases(db_session)

    assert history.created == len(cases) > 0
    assert all(c.is_seed for c in cases)
    start = END - timedelta(days=PLAN.days)
    assert all(start <= c.created_at <= END for c in cases)


def test_most_cases_are_closed_and_some_are_still_open(
    db_session: Session, history: HistoryResult
) -> None:
    statuses = [c.status for c in _cases(db_session)]

    closed = statuses.count(CaseStatus.CLOSED)
    assert closed > len(statuses) / 2
    assert history.open == sum(
        s not in (CaseStatus.CLOSED, CaseStatus.REJECTED, CaseStatus.MERGED) for s in statuses
    )
    assert history.open > 0


def test_closed_cases_have_a_consistent_lifecycle(
    db_session: Session, history: HistoryResult
) -> None:
    for case in (c for c in _cases(db_session) if c.status is CaseStatus.CLOSED):
        maybe = [case.created_at, case.assigned_at, case.accepted_at, case.started_at]
        maybe += [case.resolved_at, case.closed_at]
        stamps = [s for s in maybe if s is not None]
        assert len(stamps) == len(maybe), case.case_number
        assert stamps == sorted(stamps), case.case_number
        events = db_session.scalars(
            select(CaseEvent.occurred_at).where(CaseEvent.case_id == case.id).order_by(CaseEvent.id)
        ).all()
        assert list(events) == sorted(events), case.case_number


def test_agents_decided_every_analyzed_case(db_session: Session, history: HistoryResult) -> None:
    supervised = db_session.scalar(
        select(func.count(func.distinct(AgentDecision.case_id))).where(
            AgentDecision.agent_name == "supervisor"
        )
    )

    assert supervised == len(_cases(db_session))


def test_the_embedded_recurring_problem_is_there(
    db_session: Session, history: HistoryResult
) -> None:
    soap_at_b_wc = db_session.scalar(
        select(func.count())
        .select_from(Case)
        .join(Location, Case.location_id == Location.id)
        .join(CaseType, Case.case_type_id == CaseType.id)
        .where(Location.code == "B-Z-WC", CaseType.code == "SOAP_EMPTY")
    )

    # 17 bildirim / 30 gun -> 10 gunluk planda en az 5 (tekrarlayan sorun esigi)
    assert (soap_at_b_wc or 0) >= 5


def test_simultaneous_reports_of_the_same_problem_are_merged(
    db_session: Session, history: HistoryResult
) -> None:
    merged = [c for c in _cases(db_session) if c.status is CaseStatus.MERGED]

    assert merged
    assert all(c.parent_case_id is not None for c in merged)


def test_maintenance_is_the_slowest_to_accept(db_session: Session, history: HistoryResult) -> None:
    def accept_minutes(department_code: str) -> float:
        rows = db_session.execute(
            select(Task.created_at, Task.accepted_at)
            .join(Department, Task.department_id == Department.id)
            .where(Department.code == department_code, Task.accepted_at.is_not(None))
        ).all()
        assert rows, department_code
        return median((a - c).total_seconds() / 60 for c, a in rows if a is not None)

    assert accept_minutes("MAINTENANCE") > accept_minutes("SUPPORT_SERVICES")


def test_reporters_rated_some_closed_cases(db_session: Session, history: HistoryResult) -> None:
    rated = [c for c in _cases(db_session) if c.satisfaction_rating is not None]

    assert rated
    assert all(1 <= (c.satisfaction_rating or 0) <= 5 for c in rated)


def test_seeding_twice_adds_nothing(db_session: Session, history: HistoryResult) -> None:
    organization = seed_campus(db_session)

    again = seed_history(db_session, organization, PASSWORD, PLAN)

    assert again.created == 0
