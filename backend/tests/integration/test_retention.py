"""Veri temizligi (docs/DEPLOYMENT.md "Veri saklama"): izleme turu suresi dolmus oturum kayitlarini
ve eski okunmus bildirimleri siler; ucretsiz veritabani kotasi (Neon 0,5 GB) dolmasin."""

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, RefreshToken
from app.services.monitoring_service import MonitoringService
from app.services.retention import NOTIFICATION_KEEP, TOKEN_KEEP_AFTER_EXPIRY
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer, make_location, make_organization, make_user

DAY = timedelta(days=1)


def _token(session: Session, user_id: int, expires_in: timedelta, clock: FrozenClock) -> int:
    token = RefreshToken(
        user_id=user_id,
        token_hash=uuid.uuid4().hex + uuid.uuid4().hex,
        family_id=uuid.uuid4(),
        expires_at=clock.now() + expires_in,
    )
    session.add(token)
    session.flush()
    return token.id


def test_tick_removes_long_expired_tokens_and_old_read_notifications(
    client: TestClient, db_session: Session, clock: FrozenClock
) -> None:
    organization = make_organization(db_session)
    user = make_user(db_session, organization=organization)
    body = {"description": "Koridorda ampul yanmıyor.", "location_id": 0}
    body["location_id"] = make_location(db_session, organization).id
    headers = bearer(client, user.email)
    case_id = client.post("/api/v1/cases", json=body, headers=headers).json()["id"]
    expired = _token(db_session, user.id, -(TOKEN_KEEP_AFTER_EXPIRY + DAY), clock)
    recently_expired = _token(db_session, user.id, -DAY, clock)
    alive = _token(db_session, user.id, DAY, clock)

    def note(read_ago: timedelta | None, created_ago: timedelta | None = None) -> int:
        notification = Notification(
            user_id=user.id,
            case_id=case_id,
            event_type="CASE_CLOSED",
            case_title="Ampul",
            message="Bildiriminiz çözüldü ve kapatıldı.",
            created_at=clock.now() - (created_ago or read_ago or DAY),
            read_at=None if read_ago is None else clock.now() - read_ago,
        )
        db_session.add(notification)
        db_session.flush()
        return notification.id

    old_read = note(NOTIFICATION_KEEP + DAY)
    recent_read = note(DAY)
    unread = note(None)
    old_unread = note(None, created_ago=NOTIFICATION_KEEP + 10 * DAY)

    MonitoringService(db_session, clock, agents_enabled=False).tick()

    tokens = set(db_session.scalars(select(RefreshToken.id).where(RefreshToken.user_id == user.id)))
    notes = set(db_session.scalars(select(Notification.id).where(Notification.user_id == user.id)))
    assert expired not in tokens
    assert {recently_expired, alive} <= tokens
    assert old_read not in notes
    # Okunmamis bildirim ne kadar eski olursa olsun silinmez
    assert {recent_read, unread, old_unread} <= notes


def test_rotated_chain_can_be_removed_together(db_session: Session, clock: FrozenClock) -> None:
    # Eski kayit yenisini gosterir (replaced_by_id); ikisi de suresi dolunca tek seferde silinir
    user = make_user(db_session)
    old = _token(db_session, user.id, -(TOKEN_KEEP_AFTER_EXPIRY + 2 * DAY), clock)
    new = _token(db_session, user.id, -(TOKEN_KEEP_AFTER_EXPIRY + DAY), clock)
    record = db_session.get(RefreshToken, old)
    assert record is not None
    record.replaced_by_id = new
    db_session.flush()

    MonitoringService(db_session, clock, agents_enabled=False).tick()

    left = db_session.scalars(select(RefreshToken.id).where(RefreshToken.user_id == user.id))
    assert list(left) == []
