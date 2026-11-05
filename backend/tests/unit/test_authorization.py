import pytest

from app.core.errors import NotFoundError
from app.models import User
from app.models.enums import UserRole
from app.services.authorization import ensure_same_organization


def _user(organization_id: int) -> User:
    return User(id=1, organization_id=organization_id, role=UserRole.ADMIN)


def test_same_organization_is_allowed() -> None:
    ensure_same_organization(_user(organization_id=1), resource_organization_id=1)


def test_other_organization_looks_like_missing_record() -> None:
    # IDOR: baska kurumun kaydi "yok" gibi gorunur (404), "yasak" (403) degil
    with pytest.raises(NotFoundError):
        ensure_same_organization(_user(organization_id=1), resource_organization_id=2)
