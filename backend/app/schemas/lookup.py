"""Yonetici ekranlarindaki acilir listeler icin sozlukler (tur ve birim duzeltmesi)."""

from pydantic import BaseModel

from app.models.enums import CaseCategory
from app.schemas.case import DepartmentSummary


class DepartmentOption(BaseModel):
    id: int
    code: str
    name: str


class CaseTypeOption(BaseModel):
    id: int
    code: str
    name: str
    category: CaseCategory
    # Gorevi alan birim; OTHER ve OUT_OF_SCOPE icin bos
    default_department: DepartmentSummary | None
