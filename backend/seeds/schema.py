"""Seed YAML dosyalarinin semasi. Hatali bir dosya DB'ye dokunmadan once reddedilir (fail fast)."""

from pathlib import Path
from typing import Self

import yaml
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import (
    IMPORTANCE_WEIGHT_MAX,
    IMPORTANCE_WEIGHT_MIN,
    SEVERITY_MAX,
    SEVERITY_MIN,
)
from app.models.enums import (
    CaseCategory,
    LocationKind,
    Priority,
    ReporterKind,
    UserRole,
)


class _Strict(BaseModel):
    # Yazim hatasi olan alan adi sessizce yok sayilmasin
    model_config = ConfigDict(extra="forbid", frozen=True)


class OrganizationSeed(_Strict):
    name: str
    template_code: str


class DepartmentSeed(_Strict):
    code: str
    name: str


class DepartmentsFile(_Strict):
    organization: OrganizationSeed
    departments: list[DepartmentSeed]


class CaseTypeSeed(_Strict):
    code: str
    name: str
    category: CaseCategory
    primary: str | None
    secondary: str | None
    # agent_policies tablosu FAZ 5'te; simdilik yalniz DEPARTMENTS.md uyum testi okur
    autonomy: str
    priority: Priority
    severity: int = Field(ge=SEVERITY_MIN, le=SEVERITY_MAX)
    safety: bool
    keywords: list[str]


class CaseTypesFile(_Strict):
    case_types: list[CaseTypeSeed]


class LocationSeed(_Strict):
    code: str = Field(pattern=r"^[^/]+$")
    kind: LocationKind
    name: str
    importance: int = Field(ge=IMPORTANCE_WEIGHT_MIN, le=IMPORTANCE_WEIGHT_MAX)
    aliases: list[str] = []
    children: list["LocationSeed"] = []


class LocationsFile(_Strict):
    locations: list[LocationSeed]


class DemoUserSeed(_Strict):
    email: str
    full_name: str
    role: UserRole
    department: str | None = None
    reporter_kind: ReporterKind | None = None


class DemoUsersFile(_Strict):
    users: list[DemoUserSeed]


def load[T: BaseModel](path: Path, schema: type[T]) -> T:
    with path.open(encoding="utf-8") as file:
        return schema.model_validate(yaml.safe_load(file))


class CampusTemplate(_Strict):
    departments: DepartmentsFile
    case_types: CaseTypesFile
    locations: LocationsFile

    @classmethod
    def from_dir(cls, directory: Path) -> Self:
        return cls(
            departments=load(directory / "departments.yaml", DepartmentsFile),
            case_types=load(directory / "case_types.yaml", CaseTypesFile),
            locations=load(directory / "locations.yaml", LocationsFile),
        )
