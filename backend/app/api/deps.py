"""Route'larda ortak dependency'ler: ayarlar, servisler, giris yapmis kullanici."""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.clock import Clock, get_clock
from app.core.config import Settings
from app.core.database import get_session, get_session_factory
from app.core.errors import ForbiddenError, UnauthorizedError
from app.models import User
from app.models.enums import UserRole
from app.services.analysis_service import AnalysisLauncher, SessionScope
from app.services.auth_service import AuthService
from app.services.login_rate_limiter import LoginRateLimiter
from app.storage import Storage

# auto_error=False: token yoksa FastAPI'nin 403'u yerine bizim 401 hata formatimiz doner
_bearer = HTTPBearer(auto_error=False)


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_login_limiter(request: Request) -> LoginRateLimiter:
    # Uygulama basina tek sayac seti (app/main.py)
    limiter: LoginRateLimiter = request.app.state.login_limiter
    return limiter


def get_storage(request: Request) -> Storage:
    # Uygulama basina tek adaptor (app/main.py create_app); testler gecici klasorle degistirir
    storage: Storage = request.app.state.storage
    return storage


def get_analysis_sessions() -> SessionScope:
    """Agent hatti yanittan sonra calisir; istegin oturumu kapanmistir, kendi oturumunu acar."""
    return get_session_factory()


def get_analysis_launcher(
    settings: Annotated[Settings, Depends(get_app_settings)],
    sessions: Annotated[SessionScope, Depends(get_analysis_sessions)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> AnalysisLauncher | None:
    # Kapaliysa (AGENTS_ENABLED=false) bildirim ANALYZING'de manager'i bekler
    return AnalysisLauncher(sessions, clock) if settings.agents_enabled else None


Analysis = Annotated[AnalysisLauncher | None, Depends(get_analysis_launcher)]


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


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Route'u belirtilen rollere kisitlar: rol yoksa 403, giris yoksa 401 (docs/WORKFLOW.md)."""
    allowed = frozenset(roles)

    def dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise ForbiddenError()
        return user

    return dependency
