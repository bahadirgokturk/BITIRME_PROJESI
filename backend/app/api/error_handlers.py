"""Hatalari tek formata ceviren merkezi handler: {"error": {"code", "message", "details"}}."""

from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core import messages
from app.core.errors import DomainError
from app.schemas.error import ErrorBody, ErrorRead


def _error_response(
    status: int, error: ErrorBody, headers: dict[str, str] | None = None
) -> JSONResponse:
    body = ErrorRead(error=error).model_dump()
    return JSONResponse(status_code=status, content=jsonable_encoder(body), headers=headers)


async def _handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
    error = ErrorBody(code=exc.code, message=exc.message, details=exc.details)
    return _error_response(exc.status, error, exc.headers)


async def _handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [{"loc": list(err["loc"]), "msg": err["msg"]} for err in exc.errors()]
    error = ErrorBody(
        code="VALIDATION_ERROR", message=messages.VALIDATION_ERROR, details={"fields": fields}
    )
    return _error_response(HTTPStatus.UNPROCESSABLE_ENTITY, error)


async def _handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status = HTTPStatus(exc.status_code)
    message = messages.NOT_FOUND if status is HTTPStatus.NOT_FOUND else messages.HTTP_ERROR
    return _error_response(status, ErrorBody(code=status.name, message=message, details={}))


def register_error_handlers(app: FastAPI) -> None:
    # Dekorator formu handler'in dar exception tipini korur (add_exception_handler Exception ister)
    app.exception_handler(DomainError)(_handle_domain_error)
    app.exception_handler(RequestValidationError)(_handle_validation_error)
    app.exception_handler(StarletteHTTPException)(_handle_http_error)
