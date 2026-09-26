"""Tum modeller burada import edilir; Alembic metadata'yi buradan okur."""

from app.models.base import Base
from app.models.department import Department
from app.models.location import Location
from app.models.organization import Organization
from app.models.user import User

__all__ = ["Base", "Department", "Location", "Organization", "User"]
