"""Fotograftan tur onerisi (POST /cases/photo-suggest): bildirim formu fotograf cekilince sorar.

Fotograf bellekte islenir, saklanmaz ve bir bildirime baglanmaz. Ayni guvenlik kurallari: boyut
siniri, tur icerikten (magic bytes), bozuk ya da sikistirma bombasi dosya 415. Oneriler kurumun
aktif turleriyle sinirlidir ve Turkce adlariyla doner.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.vision import VisionAgent, VisionInput
from app.agents.vision_model import VisionModel
from app.core import messages
from app.core.constants import BYTES_PER_MB
from app.core.errors import FileTooLargeError, UnsupportedMediaTypeError
from app.models import User
from app.repositories import case_type_repository
from app.schemas.photo_suggest import PhotoSuggestRead, PhotoTypeSuggestion
from app.services.image_policy import DECODE_ERRORS, sniff


class PhotoSuggestService:
    def __init__(
        self, session: Session, actor: User, vision: VisionModel | None, max_bytes: int
    ) -> None:
        self._session = session
        self._actor = actor
        self._vision = vision
        self._max_bytes = max_bytes

    def suggest(self, data: bytes) -> PhotoSuggestRead:
        if self._vision is None:
            return PhotoSuggestRead(available=False, suggestions=[])
        if len(data) > self._max_bytes:
            limit_mb = self._max_bytes // BYTES_PER_MB or 1
            raise FileTooLargeError(messages.FILE_TOO_LARGE.format(limit_mb=limit_mb))
        sniff(data)
        try:
            embedding = self._vision.encoder.encode(data)
        except DECODE_ERRORS as error:
            raise UnsupportedMediaTypeError() from error
        result = VisionAgent(self._vision.bank).run(
            VisionInput(image_embedding=embedding), AgentContext(now=datetime.now(UTC))
        )
        names = {
            case_type.code: case_type.name
            for case_type in case_type_repository.list_active(
                self._session, self._actor.organization_id
            )
        }
        return PhotoSuggestRead(
            available=True,
            suggestions=[
                PhotoTypeSuggestion(
                    case_type_code=item.case_type_code,
                    name=names[item.case_type_code],
                    confidence=item.confidence,
                )
                for item in result.output.suggestions
                if item.case_type_code in names
            ],
        )
