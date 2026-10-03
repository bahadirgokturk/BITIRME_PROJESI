"""Tur ve birim sozlukleri (manager duzeltme ekrani). Yalniz kendi kurumunun aktif kayitlari."""

from sqlalchemy.orm import Session

from app.models import User
from app.repositories import case_type_repository, department_repository
from app.schemas.case import DepartmentSummary
from app.schemas.lookup import CaseTypeOption, DepartmentOption


class LookupService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._organization_id = actor.organization_id

    def departments(self) -> list[DepartmentOption]:
        departments = department_repository.list_active(self._session, self._organization_id)
        return [DepartmentOption.model_validate(d, from_attributes=True) for d in departments]

    def case_types(self) -> list[CaseTypeOption]:
        departments = {
            d.id: DepartmentSummary.model_validate(d, from_attributes=True)
            for d in department_repository.list_all(self._session, self._organization_id)
        }
        return [
            CaseTypeOption(
                id=ct.id,
                code=ct.code,
                name=ct.name,
                category=ct.category,
                default_department=departments.get(ct.default_department_id)
                if ct.default_department_id
                else None,
            )
            for ct in case_type_repository.list_active(self._session, self._organization_id)
        ]
