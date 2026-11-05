"""Admin tanimlari II (E2-3): bildirim turleri, SLA kurallari, agent politikalari.

Is kurallari app/services/catalog_service.py'de. Silme yok: is_active=false (politikalar haric:
tur basina tek politika vardir, tur pasiflesince o da kullanilmaz).
"""

from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import Audit, CurrentUser, require_roles
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.database import get_session
from app.models.enums import UserRole
from app.schemas.catalog import (
    AgentPolicyRead,
    AgentPolicyUpdate,
    CaseTypeAdminRead,
    CaseTypeCreate,
    CaseTypeUpdate,
    SlaRuleCreate,
    SlaRuleRead,
    SlaRuleUpdate,
)
from app.schemas.common import Page, PageParams
from app.services.catalog_service import AgentPolicyService, CaseTypeService, SlaRuleService

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses=AUTHENTICATED_RESPONSES,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
Paging = Annotated[PageParams, Depends(page_params)]
DbSession = Annotated[Session, Depends(get_session)]


def get_case_type_service(
    session: DbSession, actor: CurrentUser, auditor: Audit
) -> CaseTypeService:
    return CaseTypeService(session, actor, auditor)


def get_sla_rule_service(session: DbSession, actor: CurrentUser, auditor: Audit) -> SlaRuleService:
    return SlaRuleService(session, actor, auditor)


def get_agent_policy_service(
    session: DbSession, actor: CurrentUser, auditor: Audit
) -> AgentPolicyService:
    return AgentPolicyService(session, actor, auditor)


CaseTypes = Annotated[CaseTypeService, Depends(get_case_type_service)]
SlaRules = Annotated[SlaRuleService, Depends(get_sla_rule_service)]
Policies = Annotated[AgentPolicyService, Depends(get_agent_policy_service)]


@router.get("/case-types")
def list_case_types(paging: Paging, service: CaseTypes) -> Page[CaseTypeAdminRead]:
    return service.list(paging)


@router.post("/case-types", status_code=HTTPStatus.CREATED)
def create_case_type(payload: CaseTypeCreate, service: CaseTypes) -> CaseTypeAdminRead:
    """Yeni ture varsayilan agent politikasi da acilir (L2_NOTIFY)."""
    return service.create(payload)


@router.patch("/case-types/{case_type_id}")
def update_case_type(
    case_type_id: int, payload: CaseTypeUpdate, service: CaseTypes
) -> CaseTypeAdminRead:
    return service.update(case_type_id, payload)


@router.get("/sla-rules")
def list_sla_rules(paging: Paging, service: SlaRules) -> Page[SlaRuleRead]:
    return service.list(paging)


@router.post("/sla-rules", status_code=HTTPStatus.CREATED)
def create_sla_rule(payload: SlaRuleCreate, service: SlaRules) -> SlaRuleRead:
    return service.create(payload)


@router.patch("/sla-rules/{rule_id}")
def update_sla_rule(rule_id: int, payload: SlaRuleUpdate, service: SlaRules) -> SlaRuleRead:
    return service.update(rule_id, payload)


@router.get("/agent-policies")
def list_agent_policies(paging: Paging, service: Policies) -> Page[AgentPolicyRead]:
    return service.list(paging)


@router.patch("/agent-policies/{policy_id}")
def update_agent_policy(
    policy_id: int, payload: AgentPolicyUpdate, service: Policies
) -> AgentPolicyRead:
    return service.update(policy_id, payload)
