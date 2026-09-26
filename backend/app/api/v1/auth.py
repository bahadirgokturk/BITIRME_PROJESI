"""Kimlik dogrulama (FAZ 2, E2-1).

Access token yanit govdesinde doner, istemci bellekte tutar. Refresh token yalniz httpOnly
cookie'dedir: JavaScript okuyamaz (XSS), SameSite=Strict baska siteden gonderilemez (CSRF),
path kisitli oldugu icin yalniz /auth istekleriyle gider.
"""

from datetime import datetime
from http import HTTPStatus
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, Request, Response

from app.api.deps import CurrentUser, get_app_settings, get_auth_service
from app.api.v1.responses import ERROR_RESPONSES
from app.core.config import Environment, Settings
from app.schemas.auth import LoginRequest, TokenRead
from app.schemas.error import ErrorRead
from app.schemas.user import UserRead
from app.services.auth_service import AuthService, IssuedTokens

REFRESH_COOKIE_NAME = "cf_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

_AUTH_RESPONSES: dict[int | str, dict[str, Any]] = {
    **ERROR_RESPONSES,
    HTTPStatus.UNAUTHORIZED: {"model": ErrorRead},
    HTTPStatus.TOO_MANY_REQUESTS: {"model": ErrorRead},
}

router = APIRouter(prefix="/auth", tags=["auth"], responses=_AUTH_RESPONSES)
Auth = Annotated[AuthService, Depends(get_auth_service)]
AppSettings = Annotated[Settings, Depends(get_app_settings)]
RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)]


def _set_refresh_cookie(
    response: Response, token: str, expires_at: datetime, settings: Settings
) -> None:
    # Yerelde http://localhost kullanildigi icin Secure yalniz local disinda zorunlu
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        expires=expires_at,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.environment is not Environment.LOCAL,
        samesite="strict",
    )


def _token_response(response: Response, tokens: IssuedTokens, settings: Settings) -> TokenRead:
    _set_refresh_cookie(response, tokens.refresh_token, tokens.refresh_expires_at, settings)
    return TokenRead(access_token=tokens.access_token, expires_in=tokens.expires_in)


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    service: Auth,
    settings: AppSettings,
) -> TokenRead:
    # Canlida proxy arkasinda gercek IP icin uvicorn --proxy-headers gerekir (DEPLOYMENT.md)
    client_ip = request.client.host if request.client else "unknown"
    tokens = service.login(payload.email, payload.password, client_ip)
    return _token_response(response, tokens, settings)


@router.post("/refresh")
def refresh(
    response: Response, service: Auth, settings: AppSettings, refresh_token: RefreshCookie = None
) -> TokenRead:
    return _token_response(response, service.refresh(refresh_token), settings)


@router.post("/logout", status_code=HTTPStatus.NO_CONTENT)
def logout(response: Response, service: Auth, refresh_token: RefreshCookie = None) -> None:
    service.logout(refresh_token)
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


@router.get("/me")
def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user, from_attributes=True)
