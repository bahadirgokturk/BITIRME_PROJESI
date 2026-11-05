from datetime import datetime

from pydantic import BaseModel, computed_field

from app.models.enums import AttachmentKind


class AttachmentRead(BaseModel):
    id: int
    case_id: int
    kind: AttachmentKind
    original_name: str
    mime_type: str
    size_bytes: int
    uploaded_by: int
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        """Indirme adresi. Yetki ister: <img src> yerine fetch + Bearer ile alinir (docs/API.md)."""
        return f"/api/v1/attachments/{self.id}"
