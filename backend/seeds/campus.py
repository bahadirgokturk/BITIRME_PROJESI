"""Kampus sablonunu DB'ye yukler. Her kayit koduyla bulunur: varsa sablondaki degerlere guncellenir,
yoksa eklenir. Sablonda olmayan kayitlara (admin'in ekledikleri) dokunulmaz.

Fonksiyonlar commit etmez; islemi cagiran (seeds/run.py) tek transaction'da bitirir.
"""

from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import CaseType, Department, Location, Organization, User
from app.repositories import (
    case_type_repository,
    department_repository,
    location_repository,
    organization_repository,
    user_repository,
)
from app.repositories.location_repository import PATH_SEPARATOR
from seeds.schema import (
    CampusTemplate,
    CaseTypeSeed,
    DemoUserSeed,
    DemoUsersFile,
    DepartmentSeed,
    LocationSeed,
    OrganizationSeed,
    load,
)

SEEDS_DIR = Path(__file__).resolve().parent
CAMPUS_TEMPLATE_DIR = SEEDS_DIR / "templates" / "campus"
DEMO_USERS_FILE = SEEDS_DIR / "demo" / "users.yaml"

DepartmentIds = dict[str, int]


class SeedError(Exception):
    """Seed dosyasi ya da ortam hatali; DB'ye hicbir sey yazilmaz."""


def seed_campus(session: Session, template_dir: Path = CAMPUS_TEMPLATE_DIR) -> Organization:
    template = CampusTemplate.from_dir(template_dir)
    organization = _ensure_organization(session, template.departments.organization)
    departments = {
        seed.code: _upsert_department(session, organization.id, seed).id
        for seed in template.departments.departments
    }
    for seed in template.case_types.case_types:
        _upsert_case_type(session, organization.id, seed, departments)
    for root in template.locations.locations:
        _upsert_location(session, organization.id, None, root)
    return organization


def seed_demo_users(
    session: Session, organization: Organization, password: str, users_file: Path = DEMO_USERS_FILE
) -> int:
    """Eksik demo kullanicilarini ekler; var olanlara (parolasi degismis olabilir) dokunmaz."""
    departments = {d.code: d.id for d in department_repository.list_all(session, organization.id)}
    created = 0
    for seed in load(users_file, DemoUsersFile).users:
        if user_repository.get_by_email(session, seed.email):
            continue
        user_repository.add(session, _demo_user(organization.id, seed, password, departments))
        created += 1
    return created


def _ensure_organization(session: Session, seed: OrganizationSeed) -> Organization:
    existing = organization_repository.get_by_name(session, seed.name)
    if existing is not None:
        return existing
    return organization_repository.add(
        session, Organization(name=seed.name, template_code=seed.template_code)
    )


def _upsert_department(session: Session, organization_id: int, seed: DepartmentSeed) -> Department:
    department = department_repository.get_by_code(session, organization_id, seed.code)
    if department is None:
        return department_repository.add(
            session, Department(organization_id=organization_id, code=seed.code, name=seed.name)
        )
    _assign(department, {"name": seed.name, "is_active": True})
    return department


def _upsert_case_type(
    session: Session, organization_id: int, seed: CaseTypeSeed, departments: DepartmentIds
) -> None:
    fields = {
        "name": seed.name,
        "category": seed.category,
        "default_department_id": _department_id(departments, seed.primary),
        "secondary_department_id": _department_id(departments, seed.secondary),
        "base_priority": seed.priority,
        "base_severity": seed.severity,
        "is_safety_related": seed.safety,
        "keywords": list(seed.keywords),
        "is_active": True,
    }
    case_type = case_type_repository.get_by_code(session, organization_id, seed.code)
    if case_type is None:
        case_type_repository.add(
            session, CaseType(organization_id=organization_id, code=seed.code, **fields)
        )
        return
    _assign(case_type, fields)


def _upsert_location(
    session: Session, organization_id: int, parent: Location | None, seed: LocationSeed
) -> None:
    fields = {
        "parent_id": parent.id if parent else None,
        "kind": seed.kind,
        "name": seed.name,
        "path": parent.path + PATH_SEPARATOR + seed.code if parent else seed.code,
        "importance_weight": seed.importance,
        "aliases": list(seed.aliases),
        "is_active": True,
    }
    location = location_repository.get_by_code(session, organization_id, seed.code)
    if location is None:
        location = location_repository.add(
            session, Location(organization_id=organization_id, code=seed.code, **fields)
        )
    else:
        _assign(location, fields)
    for child in seed.children:
        _upsert_location(session, organization_id, location, child)


def _demo_user(
    organization_id: int, seed: DemoUserSeed, password: str, departments: DepartmentIds
) -> User:
    return User(
        organization_id=organization_id,
        email=seed.email.lower(),
        password_hash=hash_password(password),
        full_name=seed.full_name,
        role=seed.role,
        reporter_kind=seed.reporter_kind,
        department_id=_department_id(departments, seed.department),
    )


def _department_id(departments: DepartmentIds, code: str | None) -> int | None:
    if code is None:
        return None
    if code not in departments:
        raise SeedError(f"Bilinmeyen departman kodu: {code} (departments.yaml'a ekleyin)")
    return departments[code]


def _assign(record: object, fields: dict[str, Any]) -> None:
    for field, value in fields.items():
        setattr(record, field, value)
