"""Router'larda ortak hata yanitlari; OpenAPI'de hata tipi dogru uretilsin diye (ADR-7)."""

from http import HTTPStatus
from typing import Any

from app.schemas.error import ErrorRead

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    HTTPStatus.UNPROCESSABLE_ENTITY: {"model": ErrorRead},
    HTTPStatus.NOT_IMPLEMENTED: {"model": ErrorRead},
}
