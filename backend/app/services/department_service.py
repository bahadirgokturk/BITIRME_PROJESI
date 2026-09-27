"""Admin departman yonetimi. Her islem giris yapan admin'in kurumuyla sinirlidir."""

from sqlalchemy.orm import Session

from app.core import messages
from app.core.errors import ConflictError, NotFoundError
from app.models import Department, User
from app.repositories import department_repository
from app.schemas.common import Page, PageParams
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.services.authorization import ensure_same_organization


class DepartmentService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def list(self, paging: PageParams) -> Page[DepartmentRead]:
        items, total = department_repository.list_page(
            self._session, self._actor.organization_id, paging
        )
        return Page(
            items=[DepartmentRead.model_validate(d, from_attributes=True) for d in items],
            total=total,
            page=paging.page,
        )

    def create(self, data: DepartmentCreate) -> DepartmentRead:
        organization_id = self._actor.organization_id
        if department_repository.get_by_code(self._session, organization_id, data.code):
            raise ConflictError(messages.DUPLICATE_CODE)
        department = department_repository.add(
            self._session,
            Department(organization_id=organization_id, code=data.code, name=data.name),
        )
        self._session.commit()
        return DepartmentRead.model_validate(department, from_attributes=True)

    def update(self, department_id: int, data: DepartmentUpdate) -> DepartmentRead:
        department = self._get(department_id)
        # Yalniz gonderilen ve bos olmayan alanlar degisir (PATCH)
        for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
            setattr(department, field, value)
        self._session.commit()
        return DepartmentRead.model_validate(department, from_attributes=True)

    def _get(self, department_id: int) -> Department:
        department = department_repository.get(self._session, department_id)
        if department is None:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=department.organization_id)
        return department
