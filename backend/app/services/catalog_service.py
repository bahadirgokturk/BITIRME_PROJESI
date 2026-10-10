"""Admin tanimlari: bildirim turleri, SLA kurallari, agent politikalari (docs/API.md "Admin").

Her islem giris yapan admin'in kurumuyla sinirlidir; baska kurumun kaydi 404 (IDOR). Silme yok.
"""

from decimal import Decimal
from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core import messages
from app.core.constants import MIN_CONFIDENCE_AUTO_DEFAULT
from app.core.errors import ConflictError, InvalidSlaTargetsError, NotFoundError
from app.models import AgentPolicy, CaseType, SlaRule, User
from app.models.enums import AutonomyLevel, PolicyScope
from app.repositories import (
    agent_policy_repository,
    case_type_repository,
    department_repository,
    sla_repository,
)
from app.schemas.catalog import (
    AgentPolicyRead,
    AgentPolicyUpdate,
    CaseTypeAdminRead,
    CaseTypeCreate,
    CaseTypeUpdate,
    SlaRuleCreate,
    SlaRuleRead,
    SlaRuleUpdate,
    ensure_resolution_after_response,
)
from app.schemas.common import Page, PageParams
from app.services.authorization import ensure_same_organization

# Yeni tur icin baslangic politikasi: agent uygular, mudur bilgilendirilir (docs/AGENTS.md 5).
# Admin sonradan L1/L3'e cekebilir.
NEW_TYPE_AUTONOMY = AutonomyLevel.L2_NOTIFY
# null ile bosaltilabilen alanlar; digerlerinde null "degistirme" demektir
CASE_TYPE_NULLABLE = frozenset({"default_department_id", "secondary_department_id"})
DEPARTMENT_FIELDS = ("default_department_id", "secondary_department_id")


def changes(data: BaseModel, nullable: frozenset[str] = frozenset()) -> dict[str, Any]:
    """PATCH: gonderilen alanlar; zorunlu alana gelen null yok sayilir."""
    sent = data.model_dump(exclude_unset=True)
    return {k: v for k, v in sent.items() if v is not None or k in nullable}


def _page[T: BaseModel](read: type[T], found: tuple[Any, int], paging: PageParams) -> Page[T]:
    items, total = found
    return Page(
        items=[read.model_validate(item, from_attributes=True) for item in items],
        total=total,
        page=paging.page,
    )


class CaseTypeService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def list(self, paging: PageParams) -> Page[CaseTypeAdminRead]:
        found = case_type_repository.list_page(self._session, self._actor.organization_id, paging)
        return _page(CaseTypeAdminRead, found, paging)

    def create(self, data: CaseTypeCreate) -> CaseTypeAdminRead:
        organization_id = self._actor.organization_id
        if case_type_repository.get_by_code(self._session, organization_id, data.code):
            raise ConflictError(messages.DUPLICATE_CODE)
        self._check_departments(data.model_dump())
        case_type = case_type_repository.add(
            self._session, CaseType(organization_id=organization_id, **data.model_dump())
        )
        # Supervisor her tur icin bir politika okur (tur basina tek CASE_TYPE satiri)
        agent_policy_repository.add(
            self._session,
            AgentPolicy(
                organization_id=organization_id,
                scope=PolicyScope.CASE_TYPE,
                case_type_id=case_type.id,
                autonomy_level=NEW_TYPE_AUTONOMY,
                min_confidence_auto=Decimal(MIN_CONFIDENCE_AUTO_DEFAULT),
                notify_manager=True,
            ),
        )
        self._session.commit()
        return CaseTypeAdminRead.model_validate(case_type, from_attributes=True)

    def update(self, case_type_id: int, data: CaseTypeUpdate) -> CaseTypeAdminRead:
        case_type = get_case_type(self._session, self._actor, case_type_id)
        updates = changes(data, CASE_TYPE_NULLABLE)
        self._check_departments(updates)
        for field, value in updates.items():
            setattr(case_type, field, value)
        self._session.commit()
        return CaseTypeAdminRead.model_validate(case_type, from_attributes=True)

    def _check_departments(self, values: dict[str, Any]) -> None:
        for field in DEPARTMENT_FIELDS:
            department_id = values.get(field)
            if department_id is None:
                continue
            department = department_repository.get(self._session, department_id)
            if department is None:
                raise NotFoundError()
            ensure_same_organization(
                self._actor, resource_organization_id=department.organization_id
            )


class SlaRuleService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def list(self, paging: PageParams) -> Page[SlaRuleRead]:
        found = sla_repository.list_page(self._session, self._actor.organization_id, paging)
        return _page(SlaRuleRead, found, paging)

    def create(self, data: SlaRuleCreate) -> SlaRuleRead:
        organization_id = self._actor.organization_id
        if data.case_type_id is not None:
            get_case_type(self._session, self._actor, data.case_type_id)
        taken = sla_repository.get_rule(
            self._session, organization_id, data.case_type_id, data.priority
        )
        if taken is not None:
            raise ConflictError(messages.DUPLICATE_SLA_RULE)
        rule = sla_repository.add(
            self._session, SlaRule(organization_id=organization_id, **data.model_dump())
        )
        self._session.commit()
        return SlaRuleRead.model_validate(rule, from_attributes=True)

    def update(self, rule_id: int, data: SlaRuleUpdate) -> SlaRuleRead:
        rule = sla_repository.get(self._session, rule_id)
        if rule is None:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=rule.organization_id)
        updates = changes(data)
        response = updates.get("response_minutes", rule.response_minutes)
        resolution = updates.get("resolution_minutes", rule.resolution_minutes)
        try:
            ensure_resolution_after_response(response, resolution)
        except ValueError as error:
            raise InvalidSlaTargetsError() from error
        for field, value in updates.items():
            setattr(rule, field, value)
        self._session.commit()
        return SlaRuleRead.model_validate(rule, from_attributes=True)


class AgentPolicyService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def list(self, paging: PageParams) -> Page[AgentPolicyRead]:
        found = agent_policy_repository.list_page(
            self._session, self._actor.organization_id, paging
        )
        return _page(AgentPolicyRead, found, paging)

    def update(self, policy_id: int, data: AgentPolicyUpdate) -> AgentPolicyRead:
        policy = agent_policy_repository.get(self._session, policy_id)
        if policy is None:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=policy.organization_id)
        updates = changes(data)
        if "min_confidence_auto" in updates:
            # float -> Decimal: DB numeric; str uzerinden ki 0.85 tam 0.85 kalsin
            updates["min_confidence_auto"] = Decimal(str(updates["min_confidence_auto"]))
        for field, value in updates.items():
            setattr(policy, field, value)
        self._session.commit()
        return AgentPolicyRead.model_validate(policy, from_attributes=True)


def get_case_type(session: Session, actor: User, case_type_id: int) -> CaseType:
    case_type = case_type_repository.get(session, case_type_id)
    if case_type is None:
        raise NotFoundError()
    ensure_same_organization(actor, resource_organization_id=case_type.organization_id)
    return case_type
