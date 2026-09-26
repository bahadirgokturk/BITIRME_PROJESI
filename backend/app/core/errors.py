"""Domain hatalari. HTTP'ye ceviren tek yer app/api/error_handlers.py (KOD_KURALLARI kural 1)."""

from http import HTTPStatus
from typing import Any, ClassVar

from app.core import messages


class DomainError(Exception):
    code: ClassVar[str] = "DOMAIN_ERROR"
    status: ClassVar[HTTPStatus] = HTTPStatus.BAD_REQUEST
    default_message: ClassVar[str] = messages.HTTP_ERROR

    def __init__(self, message: str | None = None, details: dict[str, Any] | None = None) -> None:
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)

    @property
    def headers(self) -> dict[str, str]:
        return {}


class NotFoundError(DomainError):
    # Yetkisiz kaynak erisimi de 404 doner (IDOR, docs/ARCHITECTURE.md bolum 9)
    code = "NOT_FOUND"
    status = HTTPStatus.NOT_FOUND
    default_message = messages.NOT_FOUND


class UnauthorizedError(DomainError):
    code = "UNAUTHORIZED"
    status = HTTPStatus.UNAUTHORIZED
    default_message = messages.UNAUTHORIZED


class ForbiddenError(DomainError):
    # Rol bu endpoint'e hic erisemez (orn. reporter -> /admin). Kaynak bazli yetkisizlik 404 doner.
    code = "FORBIDDEN"
    status = HTTPStatus.FORBIDDEN
    default_message = messages.FORBIDDEN


class TooManyRequestsError(DomainError):
    code = "TOO_MANY_REQUESTS"
    status = HTTPStatus.TOO_MANY_REQUESTS
    default_message = messages.TOO_MANY_LOGIN_ATTEMPTS

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(details={"retry_after_seconds": retry_after_seconds})
        self.retry_after_seconds = retry_after_seconds

    @property
    def headers(self) -> dict[str, str]:
        return {"Retry-After": str(self.retry_after_seconds)}


class NotImplementedYetError(DomainError):
    # Sozlesme once: sema yayinda, is mantigi sonraki PR'da (docs/PROJECT_PLAN.md bolum 1)
    code = "NOT_IMPLEMENTED"
    status = HTTPStatus.NOT_IMPLEMENTED
    default_message = messages.NOT_IMPLEMENTED


class ConflictError(DomainError):
    code = "CONFLICT"
    status = HTTPStatus.CONFLICT
    default_message = messages.CONFLICT
