"""Kaynak bazli yetki (sahiplik) kontrolleri.

Kural (KOD_KURALLARI kural 14, docs/WORKFLOW.md bolum 4): ID ile gelen her kaynak buradan gecer;
erisim yoksa 404 doner ki kaydin varligi sizdirilmasin (IDOR). Rol bazli route kontrolu ise
app/api/deps.py icindeki require_roles ile yapilir (403).
"""

from app.core.errors import NotFoundError
from app.models import User


def ensure_same_organization(user: User, *, resource_organization_id: int) -> None:
    if user.organization_id != resource_organization_id:
        raise NotFoundError()
