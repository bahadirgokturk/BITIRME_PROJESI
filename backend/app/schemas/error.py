from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any]


class ErrorRead(BaseModel):
    """Tum hata yanitlarinin formati (app/api/error_handlers.py)."""

    error: ErrorBody
