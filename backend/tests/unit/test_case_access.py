"""Bildirim gorme yetkisi (docs/WORKFLOW.md bolum 4): yetkisiz erisim 404 (IDOR)."""

import pytest

from app.core.errors import NotFoundError
from app.models import Case, User
from app.models.enums import UserRole
from app.services.authorization import can_view_case, ensure_can_view_case

ORG = 1
REPORTER_ID = 10
STAFF_ID = 20
DEPARTMENT_ID = 5


def _case(**overrides: object) -> Case:
    fields: dict[str, object] = {
        "organization_id": ORG,
        "reporter_id": REPORTER_ID,
        "department_id": DEPARTMENT_ID,
        "assigned_staff_id": None,
    } | overrides
    return Case(**fields)


def _user(role: UserRole, user_id: int = 99, **overrides: object) -> User:
    fields: dict[str, object] = {
        "id": user_id,
        "organization_id": ORG,
        "role": role,
        "department_id": None,
    } | overrides
    return User(**fields)


@pytest.mark.parametrize(
    ("user", "allowed"),
    [
        (_user(UserRole.REPORTER, REPORTER_ID), True),
        (_user(UserRole.REPORTER), False),
        (_user(UserRole.STAFF, department_id=DEPARTMENT_ID), True),
        (_user(UserRole.STAFF, department_id=DEPARTMENT_ID + 1), False),
        (_user(UserRole.MANAGER), True),
        (_user(UserRole.ADMIN), True),
        (_user(UserRole.MANAGER, organization_id=ORG + 1), False),
        (_user(UserRole.ADMIN, organization_id=ORG + 1), False),
    ],
)
def test_view_matrix(user: User, allowed: bool) -> None:
    assert can_view_case(user, _case()) is allowed


def test_staff_sees_case_assigned_to_them_in_another_department() -> None:
    staff = _user(UserRole.STAFF, STAFF_ID, department_id=DEPARTMENT_ID + 1)

    assert can_view_case(staff, _case(assigned_staff_id=STAFF_ID)) is True


def test_staff_who_reported_the_case_can_see_it() -> None:
    # Personel de bildirim yapabilir (her rol case olusturur); kendi bildirimini gorur
    staff = _user(UserRole.STAFF, REPORTER_ID, department_id=DEPARTMENT_ID + 1)

    assert can_view_case(staff, _case()) is True


def test_unrouted_case_is_not_visible_to_staff_without_department() -> None:
    staff = _user(UserRole.STAFF, department_id=None)

    assert can_view_case(staff, _case(department_id=None)) is False


def test_forbidden_case_looks_missing() -> None:
    with pytest.raises(NotFoundError):
        ensure_can_view_case(_user(UserRole.REPORTER), _case())
