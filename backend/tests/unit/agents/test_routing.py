"""Routing Agent (AGENTS.md 4.6): birim ve personel secimi, aciklanabilir puanla."""

from datetime import UTC, datetime

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.routing import RoutingAgent, RoutingInput, StaffCandidate

CTX = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))
SUPPORT, CIVIL_DEFENSE = 1, 9


def _input(staff: list[StaffCandidate], **changes: object) -> RoutingInput:
    base = RoutingInput(
        case_type_code="SOAP_EMPTY",
        department_id=SUPPORT,
        secondary_department_id=None,
        building_code="B",
        staff=staff,
    )
    return base.model_copy(update=changes)


def _staff(user_id: int, open_tasks: int = 0, building: str | None = "B", same_type: int = 0):
    return StaffCandidate(
        user_id=user_id,
        open_task_count=open_tasks,
        current_building=building,
        recent_same_type_count=same_type,
    )


def test_least_busy_staff_member_gets_the_task() -> None:
    result = RoutingAgent().run(_input([_staff(1, open_tasks=3), _staff(2, open_tasks=1)]), CTX)

    assert result.decision == "ASSIGN_STAFF"
    assert result.output.assigned_user_id == 2
    assert result.output.department_id == SUPPORT
    assert result.model == RULES_MODEL


def test_being_in_another_building_costs_half_a_task() -> None:
    near = _staff(1, open_tasks=1, building="B")
    far = _staff(2, open_tasks=1, building="A")

    result = RoutingAgent().run(_input([far, near]), CTX)

    assert result.output.assigned_user_id == 1
    scores = {c.user_id: c.score for c in result.output.candidates}
    assert scores == {1: -1.0, 2: -1.5}


def test_unknown_building_is_not_penalised() -> None:
    # Personelin acik gorevi yoksa nerede oldugu bilinmez; ceza verilmez
    result = RoutingAgent().run(_input([_staff(1, building=None)]), CTX)

    assert result.output.candidates[0].score == 0.0


def test_experience_with_the_same_problem_breaks_close_calls() -> None:
    newcomer = _staff(1, open_tasks=1)
    veteran = _staff(2, open_tasks=1, same_type=4)

    assert RoutingAgent().run(_input([newcomer, veteran]), CTX).output.assigned_user_id == 2


def test_experience_bonus_is_capped() -> None:
    # Cok tecrubeli ama 3 isi olan biri, bosta olan birinin onune gecmez
    busy_veteran = _staff(1, open_tasks=3, same_type=100)
    idle = _staff(2)

    assert RoutingAgent().run(_input([busy_veteran, idle]), CTX).output.assigned_user_id == 2


def test_ties_go_to_the_lower_user_id() -> None:
    result = RoutingAgent().run(_input([_staff(7), _staff(3)]), CTX)

    assert result.output.assigned_user_id == 3


def test_overloaded_staff_are_skipped_and_the_task_goes_to_the_pool() -> None:
    result = RoutingAgent().run(_input([_staff(1, open_tasks=5), _staff(2, open_tasks=8)]), CTX)

    assert result.decision == "ROUTE_TO_POOL"
    assert result.output.assigned_user_id is None
    assert result.output.department_id == SUPPORT
    assert "NO_AVAILABLE_STAFF" in {r.code for r in result.reasons}


def test_case_types_without_a_department_are_not_routed() -> None:
    # OTHER: insan inceler; OUT_OF_SCOPE: gorev yok
    result = RoutingAgent().run(_input([_staff(1)], department_id=None), CTX)

    assert result.decision == "NO_DEPARTMENT"
    assert result.output.department_id is None
    assert result.output.assigned_user_id is None


def test_secondary_department_is_only_informed() -> None:
    result = RoutingAgent().run(_input([_staff(1)], secondary_department_id=CIVIL_DEFENSE), CTX)

    assert result.output.secondary_department_id == CIVIL_DEFENSE
    assert "SECONDARY_INFORMED" in {r.code for r in result.reasons}


def test_explanation_lists_the_best_candidates() -> None:
    staff = [_staff(i, open_tasks=i) for i in range(1, 6)]

    result = RoutingAgent().run(_input(staff), CTX)

    assert [c.user_id for c in result.output.candidates] == [1, 2, 3]
