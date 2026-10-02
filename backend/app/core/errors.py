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


class InvalidParentError(DomainError):
    # Lokasyon agacinda dongu olusturacak tasima (kendi altina)
    code = "INVALID_PARENT"
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    default_message = messages.INVALID_PARENT


class InvalidUserRoleError(DomainError):
    # Rol ile reporter_kind/department_id birbirini tutmuyor (docs/DATABASE.md "users")
    code = "INVALID_USER_ROLE"
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    default_message = messages.INVALID_USER_ROLE


class InvalidTransitionError(DomainError):
    # Gecis docs/WORKFLOW.md tablosunda yok (app/services/workflow.py ALLOWED_TRANSITIONS)
    code = "INVALID_TRANSITION"
    status = HTTPStatus.CONFLICT
    default_message = messages.INVALID_TRANSITION


class UnsupportedMediaTypeError(DomainError):
    # Icerik (magic bytes) izinli bir fotograf degil; dosya adina/uzantiya bakilmaz
    code = "UNSUPPORTED_MEDIA_TYPE"
    status = HTTPStatus.UNSUPPORTED_MEDIA_TYPE
    default_message = messages.UNSUPPORTED_MEDIA_TYPE


class VideoTooLongError(DomainError):
    code = "VIDEO_TOO_LONG"
    status = HTTPStatus.UNPROCESSABLE_ENTITY

    def __init__(self, max_seconds: int) -> None:
        super().__init__(
            messages.VIDEO_TOO_LONG.format(limit=max_seconds), details={"max_seconds": max_seconds}
        )


class FileTooLargeError(DomainError):
    code = "FILE_TOO_LARGE"
    status = HTTPStatus.REQUEST_ENTITY_TOO_LARGE


class ReopenWindowClosedError(DomainError):
    code = "REOPEN_WINDOW_CLOSED"
    status = HTTPStatus.CONFLICT

    def __init__(self, hours: int) -> None:
        super().__init__(
            messages.REOPEN_WINDOW_CLOSED.format(hours=hours), details={"hours": hours}
        )


class InvalidAssigneeError(DomainError):
    # Atanan kisi o departmanin aktif STAFF'i degil
    code = "INVALID_ASSIGNEE"
    status = HTTPStatus.UNPROCESSABLE_ENTITY
    default_message = messages.INVALID_ASSIGNEE


class InvalidOverrideValueError(DomainError):
    # Duzeltmede bilinmeyen tur/birim kodu ya da gecersiz oncelik
    code = "INVALID_OVERRIDE_VALUE"
    status = HTTPStatus.UNPROCESSABLE_ENTITY

    def __init__(self, field: str, value: str) -> None:
        super().__init__(
            messages.INVALID_OVERRIDE_VALUE.format(field=field, value=value),
            details={"field": field, "value": value},
        )


class SelfLockoutError(DomainError):
    # Admin kendi erisimini kaldirirsa kurumda kimse kalmayabilir
    code = "SELF_LOCKOUT"
    status = HTTPStatus.CONFLICT
    default_message = messages.SELF_LOCKOUT


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
