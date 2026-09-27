from pydantic import BaseModel, Field

from app.core.constants import IMPORTANCE_WEIGHT_MAX, IMPORTANCE_WEIGHT_MIN
from app.models.enums import LocationKind

# Yeni lokasyon icin notr onem; admin amfi/laboratuvar gibi yerlerde artirir
DEFAULT_IMPORTANCE_WEIGHT = 50


class LocationRead(BaseModel):
    id: int
    parent_id: int | None
    kind: LocationKind
    code: str
    name: str
    # Materialized path (KMP/B/B-2/B-2-WCM); sunucu hesaplar
    path: str
    importance_weight: int
    aliases: list[str]
    is_active: bool


class LocationCreate(BaseModel):
    parent_id: int | None = None
    kind: LocationKind
    # "/" path ayiricisidir; kodda kullanilamaz
    code: str = Field(min_length=1, max_length=50, pattern=r"^[^/]+$")
    name: str = Field(min_length=1, max_length=200)
    importance_weight: int = Field(
        default=DEFAULT_IMPORTANCE_WEIGHT, ge=IMPORTANCE_WEIGHT_MIN, le=IMPORTANCE_WEIGHT_MAX
    )
    aliases: list[str] = []


class LocationUpdate(BaseModel):
    parent_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    importance_weight: int | None = Field(
        default=None, ge=IMPORTANCE_WEIGHT_MIN, le=IMPORTANCE_WEIGHT_MAX
    )
    aliases: list[str] | None = None
    is_active: bool | None = None


class LocationOption(BaseModel):
    """Bildirim formundaki lokasyon secicisi icin; onem agirligi gibi yonetim alanlari yok."""

    id: int
    parent_id: int | None
    kind: LocationKind
    code: str
    name: str
    path: str
    aliases: list[str]
