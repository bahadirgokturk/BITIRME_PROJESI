from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ReporterKind, UserRole

# NIST SP 800-63B: kullanici parolasi en az 8 karakter
PASSWORD_MIN_LENGTH = 8


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    reporter_kind: ReporterKind | None
    department_id: int | None
    is_active: bool
    # True ise istemci once "parolanizi belirleyin" ekranini gosterir
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole
    reporter_kind: ReporterKind | None = None
    department_id: int | None = None
    password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: UserRole | None = None
    reporter_kind: ReporterKind | None = None
    department_id: int | None = None
    is_active: bool | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class PasswordReset(BaseModel):
    """Admin'in verdigi gecici parola; kullanici ilk giriste degistirir."""

    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH)


class ImportRowError(BaseModel):
    # Dosyadaki satir numarasi (baslik 1. satir)
    row: int
    message: str


class UserImportResult(BaseModel):
    """Hepsi ya da hicbiri: hata varsa created 0'dir; dry_run'da yazilacak sayi doner."""

    created: int
    errors: list[ImportRowError]
    dry_run: bool
