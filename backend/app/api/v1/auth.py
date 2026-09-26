"""Kimlik dogrulama (FAZ 2, E2-1). Su an yalniz sozlesme: semalar yayinda, is mantigi yok."""

from http import HTTPStatus

from fastapi import APIRouter

from app.api.v1.responses import ERROR_RESPONSES
from app.core.errors import NotImplementedYetError
from app.schemas.auth import LoginRequest, TokenRead
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"], responses=ERROR_RESPONSES)


@router.post("/login")
def login(_payload: LoginRequest) -> TokenRead:
    raise NotImplementedYetError()


@router.post("/refresh")
def refresh() -> TokenRead:
    raise NotImplementedYetError()


@router.post("/logout", status_code=HTTPStatus.NO_CONTENT)
def logout() -> None:
    raise NotImplementedYetError()


@router.get("/me")
def me() -> UserRead:
    raise NotImplementedYetError()
