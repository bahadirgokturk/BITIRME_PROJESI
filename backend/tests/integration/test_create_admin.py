"""Production ilk yonetici: demo kullanici yuklenemedigi icin tek komutla ADMIN acilir."""

import pytest
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.enums import UserRole
from app.repositories import user_repository
from scripts.create_admin import AdminSetupError, create_admin, read_password
from tests.integration.factories import make_organization, make_user

EMAIL = "bilgi.islem@bakircay.edu.tr"
NAME = "Bilgi İşlem Yöneticisi"
PASSWORD = "uzun-ve-gizli-parola-42"


def test_creates_an_active_admin_in_the_only_organization(db_session: Session) -> None:
    organization = make_organization(db_session)

    create_admin(db_session, EMAIL, NAME, PASSWORD)

    user = user_repository.get_by_email(db_session, EMAIL)
    assert user is not None
    assert (user.role, user.organization_id, user.is_active) == (
        UserRole.ADMIN,
        organization.id,
        True,
    )
    assert user.full_name == NAME
    assert verify_password(user.password_hash, PASSWORD)


def test_email_is_stored_in_lower_case(db_session: Session) -> None:
    make_organization(db_session)

    create_admin(db_session, "Bilgi.Islem@Bakircay.edu.tr", NAME, PASSWORD)

    assert user_repository.get_by_email(db_session, EMAIL) is not None


def test_existing_email_is_not_overwritten(db_session: Session) -> None:
    organization = make_organization(db_session)
    make_user(db_session, email=EMAIL, organization=organization)

    with pytest.raises(AdminSetupError, match="zaten"):
        create_admin(db_session, EMAIL, NAME, PASSWORD)


def test_without_an_organization_the_template_seed_is_asked_for(db_session: Session) -> None:
    with pytest.raises(AdminSetupError, match="kampus sablonunu"):
        create_admin(db_session, EMAIL, NAME, PASSWORD)


def test_short_password_is_rejected(db_session: Session) -> None:
    make_organization(db_session)

    with pytest.raises(AdminSetupError, match="en az"):
        create_admin(db_session, EMAIL, NAME, "kisa")


def test_password_comes_from_the_environment_before_the_prompt() -> None:
    def prompt(_: str) -> str:
        raise AssertionError("ortamda parola varken sorulmamali")

    assert read_password({"ADMIN_PASSWORD": PASSWORD}, prompt) == PASSWORD


def test_without_environment_the_password_is_asked_twice() -> None:
    answers = iter([PASSWORD, PASSWORD])

    assert read_password({}, lambda _: next(answers)) == PASSWORD


def test_mismatched_passwords_are_rejected() -> None:
    answers = iter([PASSWORD, "baska-parola-1234567"])

    with pytest.raises(AdminSetupError, match="eslesmiyor"):
        read_password({}, lambda _: next(answers))
