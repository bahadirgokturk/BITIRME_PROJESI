"""Admin kullanici yonetimi. Her islem giris yapan admin'in kurumuyla sinirlidir.

Rol kurallari (docs/DATABASE.md "users"): REPORTER'da reporter_kind zorunlu, diger rollerde bos;
STAFF ve MANAGER bir departmana bagli olmalidir.
Pasiflestirilen kullanicinin tum oturumlari kapanir.
"""

from typing import NamedTuple

from sqlalchemy.orm import Session

from app.core import messages
from app.core.clock import Clock
from app.core.errors import ConflictError, InvalidUserRoleError, NotFoundError, SelfLockoutError
from app.core.security import hash_password
from app.models import User
from app.models.enums import UserRole
from app.repositories import department_repository, refresh_token_repository, user_repository
from app.schemas.common import Page, PageParams
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.authorization import ensure_same_organization


class RoleRule(NamedTuple):
    needs_reporter_kind: bool
    needs_department: bool


ROLE_RULES: dict[UserRole, RoleRule] = {
    UserRole.REPORTER: RoleRule(needs_reporter_kind=True, needs_department=False),
    UserRole.STAFF: RoleRule(needs_reporter_kind=False, needs_department=True),
    UserRole.MANAGER: RoleRule(needs_reporter_kind=False, needs_department=True),
    UserRole.ADMIN: RoleRule(needs_reporter_kind=False, needs_department=False),
}

# PATCH'te null gonderilmesi anlamli olan alanlar (bosalt); digerlerinde null "degistirme"
_NULLABLE_FIELDS = frozenset({"reporter_kind", "department_id"})


class UserService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock

    def list(self, paging: PageParams) -> Page[UserRead]:
        items, total = user_repository.list_page(self._session, self._actor.organization_id, paging)
        return Page(
            items=[UserRead.model_validate(u, from_attributes=True) for u in items],
            total=total,
            page=paging.page,
        )

    def create(self, data: UserCreate) -> UserRead:
        email = data.email.lower()
        if user_repository.get_by_email(self._session, email):
            raise ConflictError(messages.DUPLICATE_EMAIL)
        user = User(
            organization_id=self._actor.organization_id,
            **data.model_dump(exclude={"email", "password"}),
            email=email,
            password_hash=hash_password(data.password),
        )
        self._validate(user)
        user_repository.add(self._session, user)
        self._session.commit()
        return UserRead.model_validate(user, from_attributes=True)

    def update(self, user_id: int, data: UserUpdate) -> UserRead:
        user = self._get(user_id)
        was_active = user.is_active
        changes = data.model_dump(exclude_unset=True)
        for field, value in changes.items():
            if value is not None or field in _NULLABLE_FIELDS:
                setattr(user, field, value)
        # Rolden cikan kullanicinin eski reporter_kind'i otomatik temizlenir
        if user.role is not UserRole.REPORTER and "reporter_kind" not in changes:
            user.reporter_kind = None
        self._validate(user)
        self._ensure_not_self_lockout(user)
        if was_active and not user.is_active:
            refresh_token_repository.revoke_all_for_user(self._session, user.id, self._clock.now())
        self._session.commit()
        return UserRead.model_validate(user, from_attributes=True)

    def _validate(self, user: User) -> None:
        rule = ROLE_RULES[user.role]
        if rule.needs_reporter_kind != (user.reporter_kind is not None):
            raise InvalidUserRoleError()
        if rule.needs_department and user.department_id is None:
            raise InvalidUserRoleError()
        if user.department_id is not None:
            self._ensure_own_department(user.department_id)

    def _ensure_own_department(self, department_id: int) -> None:
        department = department_repository.get(self._session, department_id)
        if department is None:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=department.organization_id)

    def _ensure_not_self_lockout(self, user: User) -> None:
        if user.id != self._actor.id:
            return
        if not user.is_active or user.role is not UserRole.ADMIN:
            raise SelfLockoutError()

    def _get(self, user_id: int) -> User:
        user = user_repository.get_by_id(self._session, user_id)
        if user is None:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=user.organization_id)
        return user
