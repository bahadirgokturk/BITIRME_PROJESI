"""Denetim izi (E2-5): admin tanimlarindaki degisiklikleri ayni transaction'da kaydeder.

Kayit icerigi okuma semalarindan (UserRead, SlaRuleRead...) alinir; parola ya da hash bu semalarda
olmadigi icin loga hic girmez.
"""

from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.models import AuditLog, User
from app.models.enums import AuditEntity
from app.repositories import audit_log_repository
from app.schemas.audit import AuditLogFilter, AuditLogRead
from app.schemas.common import Page, PageParams

CREATED = "CREATED"
UPDATED = "UPDATED"


def snapshot(record: BaseModel) -> dict[str, Any]:
    return record.model_dump(mode="json")


def diff(before: dict[str, Any], after: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Yalniz degisen alanlar: (eski degerler, yeni degerler)."""
    changed = [key for key in after if before.get(key) != after[key]]
    return {key: before.get(key) for key in changed}, {key: after[key] for key in changed}


class Auditor:
    def __init__(self, session: Session, actor: User, clock: Clock, ip_address: str | None) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock
        self._ip_address = ip_address

    def created(self, entity: AuditEntity, record: BaseModel) -> None:
        after = snapshot(record)
        self._write(entity, CREATED, after["id"], (None, after))

    def updated(self, entity: AuditEntity, before: dict[str, Any], record: BaseModel) -> None:
        """before: degisiklikten once alinan snapshot(); hic alan degismediyse kayit yazilmaz."""
        old, new = diff(before, snapshot(record))
        if new:
            self._write(entity, UPDATED, before["id"], (old, new))

    def _write(
        self,
        entity: AuditEntity,
        verb: str,
        entity_id: int,
        values: tuple[dict[str, Any] | None, dict[str, Any]],
    ) -> None:
        before, after = values
        audit_log_repository.add(
            self._session,
            AuditLog(
                organization_id=self._actor.organization_id,
                user_id=self._actor.id,
                action=f"{entity}_{verb}",
                entity_type=entity,
                entity_id=entity_id,
                before_json=before,
                after_json=after,
                ip_address=self._ip_address,
                created_at=self._clock.now(),
            ),
        )


class AuditLogService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def list(self, filters: AuditLogFilter, paging: PageParams) -> Page[AuditLogRead]:
        rows, total = audit_log_repository.list_page(
            self._session, self._actor.organization_id, filters, paging
        )
        return Page(
            items=[
                AuditLogRead(
                    id=entry.id,
                    action=entry.action,
                    entity_type=AuditEntity(entry.entity_type),
                    entity_id=entry.entity_id,
                    actor_id=entry.user_id,
                    actor_name=actor_name,
                    before=entry.before_json,
                    after=entry.after_json,
                    ip_address=entry.ip_address,
                    created_at=entry.created_at,
                )
                for entry, actor_name in rows
            ],
            total=total,
            page=paging.page,
        )
