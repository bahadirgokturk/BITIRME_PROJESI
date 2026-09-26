"""DB enum'lari (docs/DATABASE.md bolum 2). Deger = isim; PostgreSQL native enum olarak saklanir."""

from enum import StrEnum


class UserRole(StrEnum):
    REPORTER = "REPORTER"
    STAFF = "STAFF"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"


class ReporterKind(StrEnum):
    STUDENT = "STUDENT"
    ACADEMIC = "ACADEMIC"
    PERSONNEL = "PERSONNEL"


class LocationKind(StrEnum):
    CAMPUS = "CAMPUS"
    BUILDING = "BUILDING"
    FLOOR = "FLOOR"
    ROOM = "ROOM"
    WC = "WC"
    CORRIDOR = "CORRIDOR"
    OUTDOOR = "OUTDOOR"
    OTHER = "OTHER"
