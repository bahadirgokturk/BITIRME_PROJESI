import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import RefreshToken


@dataclass(frozen=True)
class NewToken:
    user_id: int
    token_hash: str
    expires_at: datetime
    family_id: uuid.UUID


def add(session: Session, token: NewToken) -> RefreshToken:
    record = RefreshToken(
        user_id=token.user_id,
        token_hash=token.token_hash,
        expires_at=token.expires_at,
        family_id=token.family_id,
    )
    session.add(record)
    # id rotasyonda eski kayda baglanmak icin hemen gerekir
    session.flush()
    return record


def get_by_hash(session: Session, token_hash: str) -> RefreshToken | None:
    return session.scalars(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).one_or_none()


def revoke_all_for_user(session: Session, user_id: int, now: datetime) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_family(session: Session, family_id: uuid.UUID, now: datetime) -> None:
    """Tek bir oturumun (giristen dogan zincirin) acik kayitlarini kapatir."""
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
