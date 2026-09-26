"""Route'larda ortak dependency'ler: ayarlar, servisler, giris yapmis kullanici."""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.clock import Clock, get_clock
from app.core.config import Settings
from app.core.database import get_session
from app.core.errors import UnauthorizedError
from app.models import User
from app.services.auth_service import AuthService
from app.services.login_rate_limiter import LoginRateLimiter

# auto_error=False: token yoksa FastAPI'nin 403'u yerine bizim 401 hata formatimiz doner
_bearer = HTTPBearer(auto_error=False)


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_login_limiter(request: Request) -> LoginRateLimiter:
    # Uygulama basina tek sayac seti (app/main.py)
    limiter: LoginRateLimiter = request.app.state.login_limiter
    return limiter


def get_auth_service(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    clock: Annotated[Clock, Depends(get_clock)],
    limiter: Annotated[LoginRateLimiter, Depends(get_login_limiter)],
) -> AuthService:
    return AuthService(session, settings, clock, limiter)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    return service.authenticate(credentials.credentials)


CurrentUser = Annotated[User, Depends(get_current_user)]
