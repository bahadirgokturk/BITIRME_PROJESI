"""Kisiye ozel bildirim kurallari (docs/API.md "Notifications").

Bildirimler olay kaydi yazilirken uretilir (WorkflowService.record): her durum degisikligi ve olay
oradan gectigi icin karar tek yerde verilir, servislerin her biri ayrica hatirlamak zorunda kalmaz.
Olayi yapan kisi kendine bildirim almaz. E-posta ya da anlik bildirim yok; zil bu tabloyu okur.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.models import Case, Notification
from app.models.enums import CaseEventType
from app.repositories import notification_repository

if TYPE_CHECKING:
    from app.services.workflow import Transition


class Audience(StrEnum):
    # Atanan personel; gorev birim havuzundaysa birimin butun personeli
    ASSIGNEE_OR_POOL = "ASSIGNEE_OR_POOL"
    ASSIGNEE = "ASSIGNEE"
    REPORTER = "REPORTER"
    # Bildirimin birimindeki mudurler (yoksa kurumun mudurleri)
    MANAGERS = "MANAGERS"
    # Yorum: bildirim yapan (ic not degilse) ve atanan personel
    PARTICIPANTS = "PARTICIPANTS"


def _always(_: "Transition") -> bool:
    return True


def _merged_here(transition: "Transition") -> bool:
    # Birlestirme olayi iki kayda da yazilir; yalniz baglanan kaydin sahibine bildirilir (ana kaydin
    # olayinda parent_case_id yok, merged_case_id var)
    return "parent_case_id" in transition.metadata


def _by_supervisor(transition: "Transition") -> bool:
    # Agent'in dogrudan mudure biraktigi bildirim (L3, guvenlik). SLA asimi ve yeniden acilma kendi
    # olaylariyla bildirilir; ayni anda yazilan ESCALATED olayi ikinci bildirim uretmez.
    return transition.agent_name == "supervisor"


@dataclass(frozen=True)
class Rule:
    audience: Audience
    message: str
    # Olay her zaman degil, yalniz bu kosulda bildirilir
    when: Callable[["Transition"], bool] = _always


RULES: dict[CaseEventType, Rule] = {
    CaseEventType.TASK_CREATED: Rule(Audience.ASSIGNEE_OR_POOL, "Size yeni bir görev atandı."),
    CaseEventType.EVIDENCE_REQUESTED: Rule(
        Audience.ASSIGNEE, "Tamamladığınız iş için kanıt (fotoğraf ya da not) istendi."
    ),
    CaseEventType.INFO_REQUESTED: Rule(Audience.REPORTER, "Bildiriminiz için ek bilgi istendi."),
    CaseEventType.WORK_STARTED: Rule(
        Audience.REPORTER, "Bildiriminiz üzerinde çalışılmaya başlandı."
    ),
    CaseEventType.CASE_CLOSED: Rule(Audience.REPORTER, "Bildiriminiz çözüldü ve kapatıldı."),
    CaseEventType.CASE_REJECTED: Rule(Audience.REPORTER, "Bildiriminiz reddedildi."),
    CaseEventType.CASE_MERGED: Rule(
        Audience.REPORTER,
        "Bildiriminiz aynı sorunu bildiren başka bir kayıtla birleştirildi.",
        when=_merged_here,
    ),
    CaseEventType.TASK_DECLINED: Rule(Audience.MANAGERS, "Personel görevi reddetti."),
    CaseEventType.CASE_REOPENED: Rule(Audience.MANAGERS, "Bildirim yeniden açıldı."),
    CaseEventType.SLA_BREACHED: Rule(Audience.MANAGERS, "Çözüm süresi (SLA) aşıldı."),
    CaseEventType.ESCALATED: Rule(
        Audience.MANAGERS, "Bildirim müdür kararını bekliyor.", when=_by_supervisor
    ),
    CaseEventType.COMMENT_ADDED: Rule(Audience.PARTICIPANTS, "Bildirime yeni yorum yazıldı."),
}

# Ana kayit kapaninca ona bagli (MERGED) bildirimlerin sahiplerine; bildirim kisinin kendi kaydina
# baglanir, cunku ana kaydi goremez (kapsam disi, 404)
MERGED_FOLLOW_UPS: dict[CaseEventType, str] = {
    CaseEventType.CASE_CLOSED: "Bildiriminizin bağlandığı kayıt çözüldü ve kapatıldı.",
}


class Notifier:
    def __init__(self, session: Session) -> None:
        self._session = session

    def on_event(self, case: Case, transition: "Transition", now: datetime) -> None:
        self._follow_merged(case, transition, now)
        rule = RULES.get(transition.event_type)
        if rule is None or not rule.when(transition):
            return
        recipients = self._recipients(case, rule.audience, transition)
        recipients.discard(transition.actor_id)
        notifications = [
            _notification(user_id, case, (transition, now), rule.message)
            for user_id in sorted(r for r in recipients if r is not None)
        ]
        notification_repository.add_all(self._session, notifications)

    def _follow_merged(self, case: Case, transition: "Transition", now: datetime) -> None:
        message = MERGED_FOLLOW_UPS.get(transition.event_type)
        if message is None:
            return
        notifications = [
            _notification(linked.reporter_id, linked, (transition, now), message)
            for linked in notification_repository.merged_into(self._session, case.id)
            if linked.reporter_id != transition.actor_id
        ]
        notification_repository.add_all(self._session, notifications)

    def _recipients(
        self, case: Case, audience: Audience, transition: "Transition"
    ) -> set[int | None]:
        if audience is Audience.REPORTER:
            return {case.reporter_id}
        if audience is Audience.ASSIGNEE:
            return {case.assigned_staff_id}
        if audience is Audience.MANAGERS:
            managers = notification_repository.managers_of(
                self._session, case.organization_id, case.department_id
            )
            return set(managers)
        if audience is Audience.PARTICIPANTS:
            internal = bool(transition.metadata.get("is_internal"))
            return {case.assigned_staff_id} | (set() if internal else {case.reporter_id})
        return self._assignee_or_pool(case)

    def _assignee_or_pool(self, case: Case) -> set[int | None]:
        if case.assigned_staff_id is not None or case.department_id is None:
            return {case.assigned_staff_id}
        return set(notification_repository.staff_of(self._session, case.department_id))


def _notification(
    user_id: int, case: Case, event: tuple["Transition", datetime], message: str
) -> Notification:
    transition, now = event
    return Notification(
        user_id=user_id,
        case_id=case.id,
        event_type=transition.event_type,
        case_title=case.title,
        message=message,
        created_at=now,
    )
