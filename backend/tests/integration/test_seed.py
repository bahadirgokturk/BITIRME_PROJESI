"""Kampus seed: DEPARTMENTS.md matrisini DB'ye yukler; tekrar calistirmak guvenlidir."""

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AgentPolicy,
    CaseType,
    Department,
    Location,
    Organization,
    SlaRule,
    User,
)
from app.models.enums import AutonomyLevel, PolicyScope, Priority, UserRole
from seeds.campus import seed_campus, seed_demo_users

DEMO_PASSWORD = "demo-parola-123"


def _count(session: Session, model: type[object], organization: Organization) -> int:
    statement = select(func.count()).where(model.organization_id == organization.id)  # type: ignore[attr-defined]
    return session.scalar(statement) or 0


def _case_type(session: Session, organization: Organization, code: str) -> CaseType:
    return session.scalars(
        select(CaseType).where(CaseType.organization_id == organization.id, CaseType.code == code)
    ).one()


def _department_code(session: Session, department_id: int | None) -> str | None:
    if department_id is None:
        return None
    department = session.get(Department, department_id)
    assert department is not None
    return department.code


def test_seed_loads_departments_case_types_and_locations(db_session: Session) -> None:
    organization = seed_campus(db_session)

    assert organization.name == "İzmir Bakırçay Üniversitesi"
    assert _count(db_session, Department, organization) == 5
    assert _count(db_session, CaseType, organization) == 19
    assert _count(db_session, Location, organization) > 0


def test_seed_is_idempotent(db_session: Session) -> None:
    first = seed_campus(db_session)
    counts = [_count(db_session, m, first) for m in (Department, CaseType, Location)]

    second = seed_campus(db_session)

    assert second.id == first.id
    assert [_count(db_session, m, second) for m in (Department, CaseType, Location)] == counts


def test_reseed_restores_template_values(db_session: Session) -> None:
    organization = seed_campus(db_session)
    projector = _case_type(db_session, organization, "PROJECTOR_FAILURE")
    projector.default_department_id = None

    seed_campus(db_session)

    assert _department_code(db_session, projector.default_department_id) == "MAINTENANCE"


def test_routing_follows_the_department_matrix(db_session: Session) -> None:
    organization = seed_campus(db_session)

    def route(code: str) -> tuple[str | None, str | None]:
        case_type = _case_type(db_session, organization, code)
        return (
            _department_code(db_session, case_type.default_department_id),
            _department_code(db_session, case_type.secondary_department_id),
        )

    assert route("SOAP_EMPTY") == ("SUPPORT_SERVICES", None)
    assert route("PROJECTOR_FAILURE") == ("MAINTENANCE", "IT_SUPPORT")
    assert route("ACCESS_CONTROL_FAILURE") == ("IT_SUPPORT", "SUPPORT_SERVICES")
    assert route("WATER_LEAK") == ("MAINTENANCE", "SUPPORT_SERVICES")
    assert route("OUT_OF_SCOPE") == (None, None)


def test_location_paths_are_computed_from_the_tree(db_session: Session) -> None:
    organization = seed_campus(db_session)

    wc = db_session.scalars(
        select(Location).where(
            Location.organization_id == organization.id, Location.code == "A-Z-WCE"
        )
    ).one()

    assert wc.path == "KMP/A/A-Z/A-Z-WCE"


def test_demo_users_can_log_in(client: TestClient, db_session: Session) -> None:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, DEMO_PASSWORD)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "temizlik@kampus.example.com", "password": DEMO_PASSWORD},
    )

    assert response.status_code == 200


def test_demo_staff_belong_to_their_department(db_session: Session) -> None:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, DEMO_PASSWORD)

    staff = db_session.scalars(select(User).where(User.email == "bt@kampus.example.com")).one()

    assert staff.role is UserRole.STAFF
    assert _department_code(db_session, staff.department_id) == "IT_SUPPORT"


def test_reseeding_demo_users_does_not_reset_changed_passwords(db_session: Session) -> None:
    # Demo kullanicisi parolasini degistirdiyse seed onu ezmez
    organization = seed_campus(db_session)
    assert seed_demo_users(db_session, organization, DEMO_PASSWORD) == 11

    created_again = seed_demo_users(db_session, organization, "baska-parola-456")

    assert created_again == 0


def test_seed_loads_sla_rules_with_type_overrides(db_session: Session) -> None:
    organization = seed_campus(db_session)
    rules = db_session.scalars(
        select(SlaRule).where(SlaRule.organization_id == organization.id)
    ).all()

    defaults = {r.priority for r in rules if r.case_type_id is None}
    soap = _case_type(db_session, organization, "SOAP_EMPTY")
    soap_rules = [r for r in rules if r.case_type_id == soap.id]

    # Her oncelik icin varsayilan kural var; sabun gibi hizli isler kendi kuralini tasir
    assert defaults == set(Priority)
    assert len(soap_rules) == 1
    assert soap_rules[0].resolution_minutes < next(
        r.resolution_minutes for r in rules if r.case_type_id is None and r.priority is Priority.LOW
    )


def test_reseeding_does_not_duplicate_sla_rules(db_session: Session) -> None:
    organization = seed_campus(db_session)
    first = _count(db_session, SlaRule, organization)

    seed_campus(db_session)

    assert _count(db_session, SlaRule, organization) == first


def _policy(session: Session, organization: Organization, code: str) -> AgentPolicy:
    case_type = _case_type(session, organization, code)
    return session.scalars(
        select(AgentPolicy).where(AgentPolicy.case_type_id == case_type.id)
    ).one()


def test_seed_creates_an_autonomy_policy_per_case_type(db_session: Session) -> None:
    organization = seed_campus(db_session)

    soap = _policy(db_session, organization, "SOAP_EMPTY")
    projector = _policy(db_session, organization, "PROJECTOR_FAILURE")
    electrical = _policy(db_session, organization, "ELECTRICAL_FAILURE")

    assert _count(db_session, AgentPolicy, organization) == 19
    assert (soap.scope, soap.autonomy_level) == (PolicyScope.CASE_TYPE, AutonomyLevel.L1_AUTONOMOUS)
    # L2: agent uygular, manager bilgilendirilir
    assert (projector.autonomy_level, projector.notify_manager) == (AutonomyLevel.L2_NOTIFY, True)
    assert electrical.autonomy_level is AutonomyLevel.L3_ESCALATE
    assert float(soap.min_confidence_auto) == 0.7


def test_reseed_keeps_one_policy_per_case_type_and_restores_it(db_session: Session) -> None:
    organization = seed_campus(db_session)
    soap = _policy(db_session, organization, "SOAP_EMPTY")
    soap.autonomy_level = AutonomyLevel.L3_ESCALATE

    seed_campus(db_session)

    assert _count(db_session, AgentPolicy, organization) == 19
    assert _policy(db_session, organization, "SOAP_EMPTY").autonomy_level is (
        AutonomyLevel.L1_AUTONOMOUS
    )
