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


class NotFoundError(DomainError):
    # Yetkisiz kaynak erisimi de 404 doner (IDOR, docs/ARCHITECTURE.md bolum 9)
    code = "NOT_FOUND"
    status = HTTPStatus.NOT_FOUND
    default_message = messages.NOT_FOUND


class NotImplementedYetError(DomainError):
    # Sozlesme once: sema yayinda, is mantigi sonraki PR'da (docs/PROJECT_PLAN.md bolum 1)
    code = "NOT_IMPLEMENTED"
    status = HTTPStatus.NOT_IMPLEMENTED
    default_message = messages.NOT_IMPLEMENTED


class ConflictError(DomainError):
    code = "CONFLICT"
    status = HTTPStatus.CONFLICT
    default_message = messages.CONFLICT
