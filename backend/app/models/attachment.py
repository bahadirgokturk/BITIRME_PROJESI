from sqlalchemy import BigInteger, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import ATTACHMENT_NAME_MAX_LENGTH
from app.models.base import Base, CreatedAtMixin, IdMixin
from app.models.enums import AttachmentKind

# sha256 hex uzunlugu
SHA256_HEX_LENGTH = 64


class Attachment(IdMixin, CreatedAtMixin, Base):
    """Bildirim fotografi. Dosya depoda (app/storage), burada yalniz ust verisi.

    task_id (kanit fotografinin gorevi) tasks tablosuyla birlikte FAZ 4'te eklenecek.
    """

    __tablename__ = "attachments"

    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"), index=True)
    uploaded_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    kind: Mapped[AttachmentKind] = mapped_column(Enum(AttachmentKind, name="attachment_kind"))
    # Sunucunun urettigi rastgele anahtar; kullanicinin dosya adi yolda hic kullanilmaz
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    # Yalniz gosterim icin (dizin kisimlari atilmis)
    original_name: Mapped[str] = mapped_column(String(ATTACHMENT_NAME_MAX_LENGTH))
    mime_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(SHA256_HEX_LENGTH))
