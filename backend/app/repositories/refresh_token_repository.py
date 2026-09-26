from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import RefreshToken


def add(session: Session, *, user_id: int, token_hash: str, expires_at: datetime) -> RefreshToken:
    record = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    session.add(record)
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
