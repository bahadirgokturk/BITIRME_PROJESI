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
from app.models.enums import AuditEntity, UserRole
from app.repositories import department_repository, refresh_token_repository, user_repository
from app.schemas.common import Page, PageParams
from app.schemas.user import (
    ImportRowError,
    PasswordReset,
    UserCreate,
    UserImportResult,
    UserListFilter,
    UserRead,
    UserUpdate,
)
from app.services.audit import PASSWORD_RESET, Auditor, snapshot
from app.services.authorization import ensure_same_organization
from app.services.user_import import ImportBatch, ImportRow, to_user


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
    def __init__(self, session: Session, actor: User, clock: Clock, auditor: Auditor) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock
        self._auditor = auditor

    def list(self, filters: UserListFilter, paging: PageParams) -> Page[UserRead]:
        items, total = user_repository.list_page(
            self._session, self._actor.organization_id, filters, paging
        )
        return Page(
            items=[UserRead.model_validate(u, from_attributes=True) for u in items],
            total=total,
            page=paging.page,
        )

    def create(self, data: UserCreate) -> UserRead:
        email = data.email.lower()
        if user_repository.get_by_email(self._session, email):
            raise ConflictError(messages.DUPLICATE_EMAIL)
        user = self._new_user(data, email)
        user.password_hash = hash_password(data.password)
        self._validate(user)
        user_repository.add(self._session, user)
        created = UserRead.model_validate(user, from_attributes=True)
        self._auditor.created(AuditEntity.USER, created)
        self._session.commit()
        return created

    def update(self, user_id: int, data: UserUpdate) -> UserRead:
        user = self._get(user_id)
        before = snapshot(UserRead.model_validate(user, from_attributes=True))
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
        updated = UserRead.model_validate(user, from_attributes=True)
        self._auditor.updated(AuditEntity.USER, before, updated)
        self._session.commit()
        return updated

    def import_users(self, batch: ImportBatch) -> UserImportResult:
        """Hepsi ya da hicbiri: bir satir hataliysa kimse eklenmez, butun hatalar listelenir."""
        departments = {
            d.code: d.id
            for d in department_repository.list_all(self._session, self._actor.organization_id)
        }
        # Gecici parola herkese ayni: argon2 bir kez hesaplanir (2.000 satir dakikalar surmesin)
        password_hash = hash_password(batch.password)
        users: list[User] = []
        errors: list[ImportRowError] = []
        seen: set[str] = set()
        for row in batch.rows:
            outcome = self._import_row(row, departments, batch.password, seen)
            if isinstance(outcome, str):
                errors.append(ImportRowError(row=row.row, message=outcome))
                continue
            outcome.password_hash = password_hash
            users.append(outcome)
        if errors or batch.dry_run:
            created = 0 if errors else len(users)
            return UserImportResult(created=created, errors=errors, dry_run=batch.dry_run)
        for user in users:
            user_repository.add(self._session, user)
            created_user = UserRead.model_validate(user, from_attributes=True)
            self._auditor.created(AuditEntity.USER, created_user)
        self._session.commit()
        return UserImportResult(created=len(users), errors=[], dry_run=False)

    def _import_row(
        self, row: ImportRow, departments: dict[str, int], password: str, seen: set[str]
    ) -> User | str:
        code = row.fields.get("department_code", "")
        if code and code not in departments:
            return messages.IMPORT_UNKNOWN_DEPARTMENT.format(code=code)
        data = to_user(row, departments.get(code), password)
        if isinstance(data, str):
            return data
        email = data.email.lower()
        if email in seen:
            return messages.IMPORT_DUPLICATE_IN_FILE
        seen.add(email)
        if user_repository.get_by_email(self._session, email):
            return messages.DUPLICATE_EMAIL
        user = self._new_user(data, email)
        try:
            self._validate(user)
        except InvalidUserRoleError:
            return messages.INVALID_USER_ROLE
        return user

    def reset_password(self, user_id: int, data: PasswordReset) -> UserRead:
        """Unutulan parola: admin gecici parola verir, kullanicinin acik oturumlari kapanir."""
        user = self._get(user_id)
        if user.id == self._actor.id:
            # Kendi parolasi profilden, mevcut parolayla degisir
            raise SelfLockoutError()
        user.password_hash = hash_password(data.new_password)
        user.must_change_password = True
        refresh_token_repository.revoke_all_for_user(self._session, user.id, self._clock.now())
        updated = UserRead.model_validate(user, from_attributes=True)
        self._auditor.event(AuditEntity.USER, PASSWORD_RESET, updated)
        self._session.commit()
        return updated

    def _new_user(self, data: UserCreate, email: str) -> User:
        return User(
            organization_id=self._actor.organization_id,
            **data.model_dump(exclude={"email", "password"}),
            email=email,
            # Parolayi admin belirledi: kullanici ilk giriste kendi parolasini secer
            must_change_password=True,
        )

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
