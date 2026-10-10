"""Admin tanimlari (FAZ 2, E2-3): kullanicilar, departmanlar, lokasyonlar; denetim izi (E2-5).

Silme yok: is_active=false ile pasiflestirilir (soft delete).
"""

from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import Audit, CurrentUser, require_roles
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.models.enums import UserRole
from app.schemas.audit import AuditLogFilter, AuditLogRead
from app.schemas.common import Page, PageParams
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.audit import AuditLogService
from app.services.department_service import DepartmentService
from app.services.location_service import LocationService
from app.services.user_service import UserService

# Sistem tanimlari yalniz ADMIN'e acik; MANAGER operasyon yapar, tanim degistirmez (gorev ayriligi)
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses=AUTHENTICATED_RESPONSES,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
Paging = Annotated[PageParams, Depends(page_params)]
DbSession = Annotated[Session, Depends(get_session)]


def get_department_service(
    session: DbSession, actor: CurrentUser, auditor: Audit
) -> DepartmentService:
    return DepartmentService(session, actor, auditor)


def get_location_service(session: DbSession, actor: CurrentUser, auditor: Audit) -> LocationService:
    return LocationService(session, actor, auditor)


def get_user_service(
    session: DbSession,
    actor: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
    auditor: Audit,
) -> UserService:
    return UserService(session, actor, clock, auditor)


def get_audit_log_service(session: DbSession, actor: CurrentUser) -> AuditLogService:
    return AuditLogService(session, actor)


Users = Annotated[UserService, Depends(get_user_service)]
Departments = Annotated[DepartmentService, Depends(get_department_service)]
Locations = Annotated[LocationService, Depends(get_location_service)]
AuditLogs = Annotated[AuditLogService, Depends(get_audit_log_service)]


@router.get("/users")
def list_users(paging: Paging, service: Users) -> Page[UserRead]:
    return service.list(paging)


@router.post("/users", status_code=HTTPStatus.CREATED)
def create_user(payload: UserCreate, service: Users) -> UserRead:
    return service.create(payload)


@router.patch("/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, service: Users) -> UserRead:
    return service.update(user_id, payload)


@router.get("/departments")
def list_departments(paging: Paging, service: Departments) -> Page[DepartmentRead]:
    return service.list(paging)


@router.post("/departments", status_code=HTTPStatus.CREATED)
def create_department(payload: DepartmentCreate, service: Departments) -> DepartmentRead:
    return service.create(payload)


@router.patch("/departments/{department_id}")
def update_department(
    department_id: int, payload: DepartmentUpdate, service: Departments
) -> DepartmentRead:
    return service.update(department_id, payload)


@router.get("/locations")
def list_locations(paging: Paging, service: Locations) -> Page[LocationRead]:
    return service.list(paging)


@router.post("/locations", status_code=HTTPStatus.CREATED)
def create_location(payload: LocationCreate, service: Locations) -> LocationRead:
    return service.create(payload)


@router.patch("/locations/{location_id}")
def update_location(location_id: int, payload: LocationUpdate, service: Locations) -> LocationRead:
    return service.update(location_id, payload)


@router.get("/audit-logs")
def list_audit_logs(
    paging: Paging, service: AuditLogs, filters: Annotated[AuditLogFilter, Query()]
) -> Page[AuditLogRead]:
    """Admin tanimlarindaki degisiklikler, en yeni once.

    entity_type + entity_id ile tek bir kaydin gecmisi suzulur.
    """
    return service.list(filters, paging)
