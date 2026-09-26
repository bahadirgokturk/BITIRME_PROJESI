"""Giris, token yenileme (rotasyon + calinma tespiti), cikis ve access token dogrulama.

Guvenlik kararlari (docs/ARCHITECTURE.md bolum 9):
- Yanlis e-posta, yanlis parola ve pasif kullanici ayni hatayi alir; bilinmeyen e-postada da
  parola dogrulamasi yapilir ki cevap suresi kayitli e-postalari ele vermesin.
- Refresh token her kullanimda yenilenir; iptal edilmis bir token tekrar gelirse kullanicinin
  tum oturumlari kapatilir. Istisna: az once rotasyonla yenilenmis token kisa sure icinde tekrar
  gelirse (iki sekme ayni anda) yalniz reddedilir (REFRESH_REUSE_GRACE_SECONDS).
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core import messages
from app.core.clock import Clock
from app.core.config import Settings
from app.core.constants import REFRESH_REUSE_GRACE_SECONDS
from app.core.errors import UnauthorizedError
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models import RefreshToken, User
from app.repositories import refresh_token_repository, user_repository

logger = logging.getLogger(__name__)

# Bilinmeyen e-postada da ayni maliyette argon2 dogrulamasi yapmak icin (zamanlama saldirisi)
_TIMING_DUMMY_HASH = hash_password("timing-dummy-password-never-valid")


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    expires_in: int
    refresh_token: str
    refresh_expires_at: datetime


class AuthService:
    def __init__(self, session: Session, settings: Settings, clock: Clock) -> None:
        self._session = session
        self._settings = settings
        self._clock = clock

    def login(self, email: str, password: str) -> IssuedTokens:
        user = user_repository.get_by_email(self._session, email)
        password_hash = user.password_hash if user else _TIMING_DUMMY_HASH
        password_ok = verify_password(password_hash, password)
        if user is None or not password_ok or not user.is_active:
            raise UnauthorizedError(messages.INVALID_CREDENTIALS)
        user.last_login_at = self._clock.now()
        tokens, _ = self._issue(user)
        self._session.commit()
        return tokens

    def refresh(self, raw_token: str | None) -> IssuedTokens:
        record = self._find_refresh_record(raw_token)
        now = self._clock.now()
        if record.revoked_at is not None:
            self._handle_reuse(record, now)
        if record.expires_at <= now:
            raise UnauthorizedError()
        user = self._active_user(record.user_id)
        tokens, new_record = self._issue(user)
        record.revoked_at = now
        record.replaced_by_id = new_record.id
        self._session.commit()
        return tokens

    def logout(self, raw_token: str | None) -> None:
        # Cikis her zaman basarili gorunur; gecerli bir token varsa DB'de iptal edilir
        if raw_token is None:
            return
        record = refresh_token_repository.get_by_hash(self._session, hash_refresh_token(raw_token))
        if record is None or record.revoked_at is not None:
            return
        record.revoked_at = self._clock.now()
        self._session.commit()

    def authenticate(self, access_token: str) -> User:
        try:
            claims = decode_access_token(
                access_token, secret=self._settings.jwt_secret, now=self._clock.now()
            )
        except InvalidTokenError as error:
            raise UnauthorizedError() from error
        return self._active_user(claims.user_id)

    def _issue(self, user: User) -> tuple[IssuedTokens, RefreshToken]:
        now = self._clock.now()
        access_ttl = timedelta(minutes=self._settings.jwt_access_ttl_min)
        refresh_expires_at = now + timedelta(days=self._settings.jwt_refresh_ttl_days)
        raw_refresh = generate_refresh_token()
        record = refresh_token_repository.add(
            self._session,
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_expires_at,
        )
        access = create_access_token(
            user_id=user.id,
            role=user.role.value,
            secret=self._settings.jwt_secret,
            ttl=access_ttl,
            now=now,
        )
        tokens = IssuedTokens(
            access_token=access,
            expires_in=int(access_ttl.total_seconds()),
            refresh_token=raw_refresh,
            refresh_expires_at=refresh_expires_at,
        )
        return tokens, record

    def _find_refresh_record(self, raw_token: str | None) -> RefreshToken:
        if raw_token is None:
            raise UnauthorizedError()
        record = refresh_token_repository.get_by_hash(self._session, hash_refresh_token(raw_token))
        if record is None:
            raise UnauthorizedError()
        return record

    def _active_user(self, user_id: int) -> User:
        user = user_repository.get_by_id(self._session, user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError()
        return user

    def _handle_reuse(self, record: RefreshToken, now: datetime) -> None:
        # Az once rotasyonla yenilenmis token: ayni kullanicinin es zamanli istegi, yalniz reddet
        rotated_just_now = (
            record.replaced_by_id is not None
            and record.revoked_at is not None
            and now - record.revoked_at <= timedelta(seconds=REFRESH_REUSE_GRACE_SECONDS)
        )
        if not rotated_just_now:
            self._revoke_all_sessions(record.user_id, now)
        raise UnauthorizedError()

    def _revoke_all_sessions(self, user_id: int, now: datetime) -> None:
        # Calinma belirtisi: iptal kaydi hata firlatilmadan once kalici olmali
        logger.warning(
            "refresh token reuse detected; revoking all sessions", extra={"user_id": user_id}
        )
        refresh_token_repository.revoke_all_for_user(self._session, user_id, now)
        self._session.commit()
