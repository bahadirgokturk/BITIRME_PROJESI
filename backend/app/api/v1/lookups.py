"""Sozlukler: yonetici duzeltme ekraninda tur ve birim secimi (MANAGER, ADMIN)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, require_roles
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.database import get_session
from app.models.enums import UserRole
from app.schemas.lookup import CaseTypeOption, DepartmentOption
from app.services.lookup_service import LookupService

router = APIRouter(
    tags=["lookups"],
    responses=AUTHENTICATED_RESPONSES,
    dependencies=[Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN))],
)


def get_lookup_service(
    session: Annotated[Session, Depends(get_session)], user: CurrentUser
) -> LookupService:
    return LookupService(session, user)


Lookups = Annotated[LookupService, Depends(get_lookup_service)]


@router.get("/case-types")
def list_case_types(service: Lookups) -> list[CaseTypeOption]:
    """Aktif bildirim turleri (override: case_type kodu buradan secilir)."""
    return service.case_types()


@router.get("/departments")
def list_departments(service: Lookups) -> list[DepartmentOption]:
    """Aktif birimler (override: department kodu, atama: department_id)."""
    return service.departments()
