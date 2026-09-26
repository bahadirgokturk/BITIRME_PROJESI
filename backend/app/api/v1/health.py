from dataclasses import asdict
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.schemas.health import HealthRead
from app.services.health_service import HealthService

router = APIRouter(tags=["system"])


def get_health_service(session: Annotated[Session, Depends(get_session)]) -> HealthService:
    return HealthService(session)


@router.get(
    "/health",
    response_model=HealthRead,
    responses={HTTPStatus.SERVICE_UNAVAILABLE: {"model": HealthRead}},
)
def health(
    response: Response, service: Annotated[HealthService, Depends(get_health_service)]
) -> HealthRead:
    report = service.check()
    if report.status != "ok":
        response.status_code = HTTPStatus.SERVICE_UNAVAILABLE
    return HealthRead(**asdict(report))
