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
