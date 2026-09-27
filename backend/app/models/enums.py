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


class CaseCategory(StrEnum):
    CLEANING = "CLEANING"
    CONSUMABLE = "CONSUMABLE"
    TECHNICAL = "TECHNICAL"
    IT = "IT"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY = "SECURITY"
    FOOD_SERVICE = "FOOD_SERVICE"
    OTHER = "OTHER"


class Priority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
