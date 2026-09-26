"""Admin tanimlari (FAZ 2, E2-3). Su an yalniz sozlesme.

Silme yok: is_active=false ile pasiflestirilir (soft delete).
"""

from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.v1.pagination import PageParams, page_params
from app.api.v1.responses import ERROR_RESPONSES
from app.core.errors import NotImplementedYetError
from app.schemas.common import Page
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/admin", tags=["admin"], responses=ERROR_RESPONSES)
Paging = Annotated[PageParams, Depends(page_params)]


@router.get("/users")
def list_users(_paging: Paging) -> Page[UserRead]:
    raise NotImplementedYetError()


@router.post("/users", status_code=HTTPStatus.CREATED)
def create_user(_payload: UserCreate) -> UserRead:
    raise NotImplementedYetError()


@router.patch("/users/{user_id}")
def update_user(user_id: int, _payload: UserUpdate) -> UserRead:
    raise NotImplementedYetError()


@router.get("/departments")
def list_departments(_paging: Paging) -> Page[DepartmentRead]:
    raise NotImplementedYetError()


@router.post("/departments", status_code=HTTPStatus.CREATED)
def create_department(_payload: DepartmentCreate) -> DepartmentRead:
    raise NotImplementedYetError()


@router.patch("/departments/{department_id}")
def update_department(department_id: int, _payload: DepartmentUpdate) -> DepartmentRead:
    raise NotImplementedYetError()


@router.get("/locations")
def list_locations(_paging: Paging) -> Page[LocationRead]:
    raise NotImplementedYetError()


@router.post("/locations", status_code=HTTPStatus.CREATED)
def create_location(_payload: LocationCreate) -> LocationRead:
    raise NotImplementedYetError()


@router.patch("/locations/{location_id}")
def update_location(location_id: int, _payload: LocationUpdate) -> LocationRead:
    raise NotImplementedYetError()
