"""Kaynak bazli yetki (sahiplik) kontrolleri.

Kural (KOD_KURALLARI kural 14, docs/WORKFLOW.md bolum 4): ID ile gelen her kaynak buradan gecer;
erisim yoksa 404 doner ki kaydin varligi sizdirilmasin (IDOR). Rol bazli route kontrolu ise
app/api/deps.py icindeki require_roles ile yapilir (403).
"""

from app.core.errors import NotFoundError
from app.models import Case, Task, User
from app.models.enums import UserRole

# MVP'de manager ve admin kurumun tum bildirimlerini gorur (docs/WORKFLOW.md bolum 4 notlar)
_ORGANIZATION_WIDE_ROLES = frozenset({UserRole.MANAGER, UserRole.ADMIN})


def ensure_same_organization(user: User, *, resource_organization_id: int) -> None:
    if user.organization_id != resource_organization_id:
        raise NotFoundError()


def can_view_case(user: User, case: Case) -> bool:
    """REPORTER kendi bildirimini; STAFF kendi bildirimini, kendisine atanani ve departmanina
    yonlendirileni; MANAGER/ADMIN kurumun tumunu gorur (docs/WORKFLOW.md bolum 4).

    Liste sorgusundaki kapsam (services/case_service.py scope_for) ayni kurali uygular.
    """
    if user.organization_id != case.organization_id:
        return False
    if user.role in _ORGANIZATION_WIDE_ROLES or case.reporter_id == user.id:
        return True
    if user.role is not UserRole.STAFF:
        return False
    in_department = user.department_id is not None and case.department_id == user.department_id
    return in_department or case.assigned_staff_id == user.id


def ensure_can_view_case(user: User, case: Case) -> None:
    if not can_view_case(user, case):
        raise NotFoundError()


def can_view_task(user: User, task: Task) -> bool:
    """MANAGER/ADMIN kurumdaki tum gorevleri; STAFF kendisine atanani ve departmaninin sahipsiz
    kuyrugunu gorur (docs/WORKFLOW.md bolum 4). Liste sorgusu (StaffQueue) ayni kurali uygular.
    """
    if user.organization_id != task.case.organization_id:
        return False
    if user.role in _ORGANIZATION_WIDE_ROLES:
        return True
    if user.role is not UserRole.STAFF:
        return False
    if task.assigned_user_id is not None:
        return task.assigned_user_id == user.id
    return user.department_id is not None and task.department_id == user.department_id


def ensure_can_view_task(user: User, task: Task) -> None:
    if not can_view_task(user, task):
        raise NotFoundError()
