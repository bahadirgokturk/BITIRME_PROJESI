"""Bildirim fotograf ve videolari (E3-3). Kurallar: attachment_service ve *_policy modulleri."""

from http import HTTPStatus
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.agents.vision_model import VisionModel
from app.api.deps import (
    CurrentUser,
    get_analysis_sessions,
    get_app_settings,
    get_storage,
    get_vision_model,
)
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.config import Settings
from app.core.constants import BYTES_PER_MB
from app.core.database import get_session
from app.schemas.attachment import AttachmentRead
from app.schemas.error import ErrorRead
from app.services.analysis_service import SessionScope
from app.services.attachment_service import AttachmentService, UploadConfig, UploadedFile
from app.services.photo_check_service import PhotoChecker, PhotoCheckLauncher
from app.storage import Storage

router = APIRouter(tags=["attachments"], responses=AUTHENTICATED_RESPONSES)

UPLOAD_ERRORS: dict[int | str, dict[str, Any]] = {
    HTTPStatus.CONFLICT: {"model": ErrorRead},
    HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": ErrorRead},
    HTTPStatus.UNSUPPORTED_MEDIA_TYPE: {"model": ErrorRead},
    HTTPStatus.UNPROCESSABLE_ENTITY: {"model": ErrorRead},
}


def get_attachment_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    storage: Annotated[Storage, Depends(get_storage)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AttachmentService:
    config = UploadConfig(
        storage=storage,
        max_image_bytes=settings.max_upload_mb * BYTES_PER_MB,
        max_video_bytes=settings.max_video_mb * BYTES_PER_MB,
    )
    return AttachmentService(session, user, config)


Attachments = Annotated[AttachmentService, Depends(get_attachment_service)]


def get_photo_checker(
    sessions: Annotated[SessionScope, Depends(get_analysis_sessions)],
    clock: Annotated[Clock, Depends(get_clock)],
    vision: Annotated[VisionModel | None, Depends(get_vision_model)],
    storage: Annotated[Storage, Depends(get_storage)],
) -> PhotoChecker | None:
    # Goruntu modeli yoksa (CI, kapali) kontrol yapilmaz; yukleme etkilenmez
    return PhotoChecker(sessions, clock, vision, storage) if vision is not None else None


def get_photo_check(
    background: BackgroundTasks,
    checker: Annotated[PhotoChecker | None, Depends(get_photo_checker)],
) -> PhotoCheckLauncher | None:
    return PhotoCheckLauncher(checker, background) if checker is not None else None


PhotoCheck = Annotated[PhotoCheckLauncher | None, Depends(get_photo_check)]


@router.post(
    "/cases/{case_id}/attachments", status_code=HTTPStatus.CREATED, responses=UPLOAD_ERRORS
)
def upload_attachment(
    case_id: int, file: UploadFile, service: Attachments, photo_check: PhotoCheck
) -> AttachmentRead:
    """Bildirim fotografi yuklenince fotograf-metin kontrolu arka planda calisir (Photo Check)."""
    # Siniri bir bayt asacak kadar okunur: buyuk dosya bellege tumuyle alinmadan reddedilir
    data = file.file.read(service.read_limit)
    created = service.upload(case_id, UploadedFile(name=file.filename or "", data=data))
    if photo_check is not None:
        photo_check.after_upload(created)
    return created


@router.get("/cases/{case_id}/attachments")
def list_attachments(case_id: int, service: Attachments) -> list[AttachmentRead]:
    return service.list_for_case(case_id)


@router.get(
    "/attachments/{attachment_id}",
    response_class=Response,
    responses={HTTPStatus.OK: {"content": {"image/*": {}, "video/*": {}}}},
)
def download_attachment(attachment_id: int, service: Attachments) -> Response:
    file = service.download(attachment_id)
    return Response(
        content=file.data,
        media_type=file.mime_type,
        headers={
            # Tarayici icerigi tahmin edip HTML gibi calistirmasin
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(file.name)}",
            "Cache-Control": "private, no-store",
        },
    )
