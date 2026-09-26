"""Hatalari tek formata ceviren merkezi handler: {"error": {"code", "message", "details"}}."""

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core import messages
from app.core.errors import DomainError


def _error_response(
    status: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return JSONResponse(status_code=status, content=jsonable_encoder(body))


async def _handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
    return _error_response(exc.status, exc.code, exc.message, exc.details)


async def _handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [{"loc": list(err["loc"]), "msg": err["msg"]} for err in exc.errors()]
    return _error_response(
        HTTPStatus.UNPROCESSABLE_ENTITY,
        "VALIDATION_ERROR",
        messages.VALIDATION_ERROR,
        {"fields": fields},
    )


async def _handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status = HTTPStatus(exc.status_code)
    message = messages.NOT_FOUND if status is HTTPStatus.NOT_FOUND else messages.HTTP_ERROR
    return _error_response(status, status.name, message)


def register_error_handlers(app: FastAPI) -> None:
    # Dekorator formu handler'in dar exception tipini korur (add_exception_handler Exception ister)
    app.exception_handler(DomainError)(_handle_domain_error)
    app.exception_handler(RequestValidationError)(_handle_validation_error)
    app.exception_handler(StarletteHTTPException)(_handle_http_error)
