"""Bildirim fotograflari (E3-3). Yetki bildirimi gorme kuralina baglidir (can_view_case, 404);
ADMIN operasyona karismadigi icin yukleyemez (403, docs/WORKFLOW.md bolum 4).

Dosya once depoya, sonra kaydi DB'ye yazilir: commit basarisiz olursa sahipsiz dosya kalir ama
dosyasi olmayan kayit hic olusmaz.
"""

from dataclasses import dataclass
from pathlib import PurePosixPath
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core import messages
from app.core.constants import ATTACHMENT_NAME_MAX_LENGTH, MAX_ATTACHMENTS_PER_CASE
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Attachment, Case, User
from app.models.enums import AttachmentKind, UserRole
from app.repositories import attachment_repository, case_repository
from app.schemas.attachment import AttachmentRead
from app.services.authorization import ensure_can_view_case
from app.services.image_policy import clean_image
from app.storage import Storage


@dataclass(frozen=True)
class UploadConfig:
    storage: Storage
    max_bytes: int


@dataclass(frozen=True)
class UploadedFile:
    name: str
    data: bytes


@dataclass(frozen=True)
class FileDownload:
    data: bytes
    mime_type: str
    name: str


# Personelin yukledigi fotograf is kanitidir; digerleri bildirimi anlatir
_KIND_BY_ROLE = {UserRole.STAFF: AttachmentKind.EVIDENCE}


def safe_name(name: str, extension: str) -> str:
    """Dizin kisimlarini atar ("../../x.png" -> "x.png"); ad yalniz gosterimde kullanilir."""
    base = PurePosixPath(name.replace("\\", "/")).name.strip()
    return base[:ATTACHMENT_NAME_MAX_LENGTH] or f"fotograf.{extension}"


class AttachmentService:
    def __init__(self, session: Session, actor: User, config: UploadConfig) -> None:
        self._session = session
        self._actor = actor
        self._config = config

    def upload(self, case_id: int, file: UploadedFile) -> AttachmentRead:
        case = self._visible_case(case_id)
        if self._actor.role is UserRole.ADMIN:
            raise ForbiddenError()
        if attachment_repository.count_for_case(self._session, case.id) >= MAX_ATTACHMENTS_PER_CASE:
            raise ConflictError(
                messages.TOO_MANY_ATTACHMENTS.format(limit=MAX_ATTACHMENTS_PER_CASE)
            )
        image = clean_image(file.data, max_bytes=self._config.max_bytes)
        key = f"{case.id}/{uuid4().hex}.{image.extension}"
        self._config.storage.save(key, image.data)
        attachment = attachment_repository.add(
            self._session,
            Attachment(
                case_id=case.id,
                uploaded_by=self._actor.id,
                kind=_KIND_BY_ROLE.get(self._actor.role, AttachmentKind.REPORT),
                storage_key=key,
                original_name=safe_name(file.name, image.extension),
                mime_type=image.mime_type,
                size_bytes=len(image.data),
                sha256=image.sha256,
            ),
        )
        self._session.commit()
        return AttachmentRead.model_validate(attachment, from_attributes=True)

    def list_for_case(self, case_id: int) -> list[AttachmentRead]:
        case = self._visible_case(case_id)
        return [
            AttachmentRead.model_validate(item, from_attributes=True)
            for item in attachment_repository.list_for_case(self._session, case.id)
        ]

    def download(self, attachment_id: int) -> FileDownload:
        attachment = attachment_repository.get(self._session, attachment_id)
        if attachment is None:
            raise NotFoundError()
        self._visible_case(attachment.case_id)
        return FileDownload(
            data=self._config.storage.read(attachment.storage_key),
            mime_type=attachment.mime_type,
            name=attachment.original_name,
        )

    def _visible_case(self, case_id: int) -> Case:
        case = case_repository.get(self._session, case_id)
        if case is None:
            raise NotFoundError()
        ensure_can_view_case(self._actor, case)
        return case
