"""Hatali giris denemelerini sinirlar (kaba kuvvet ve e-posta listesi deneme saldirilari).

Sayaclar bellektedir: tek backend instance'i icin yeterli (ucretsiz Render tek instance).
Birden fazla instance'a gecilirse sayaclar paylasilan bir depoya (Postgres) tasinmali.
"""

from collections import deque
from datetime import datetime, timedelta

from app.core.constants import (
    LOGIN_FAILURE_WINDOW_MINUTES,
    LOGIN_LIMITER_PRUNE_THRESHOLD,
    LOGIN_MAX_FAILURES_PER_EMAIL,
    LOGIN_MAX_FAILURES_PER_IP,
)
from app.core.errors import TooManyRequestsError

_WINDOW = timedelta(minutes=LOGIN_FAILURE_WINDOW_MINUTES)


class LoginRateLimiter:
    def __init__(self) -> None:
        self._failures: dict[str, deque[datetime]] = {}

    def check(self, *, email: str, ip: str, now: datetime) -> None:
        # Kayitli olsun olmasin her e-posta ayni kurala tabidir; sinir hicbir sey sizdirmaz
        limits = (
            (_email_key(email), LOGIN_MAX_FAILURES_PER_EMAIL),
            (_ip_key(ip), LOGIN_MAX_FAILURES_PER_IP),
        )
        for key, limit in limits:
            recent = self._recent(key, now)
            if len(recent) >= limit:
                retry_after = recent[0] + _WINDOW - now
                raise TooManyRequestsError(
                    retry_after_seconds=max(1, int(retry_after.total_seconds()))
                )

    def record_failure(self, *, email: str, ip: str, now: datetime) -> None:
        self._prune_if_large(now)
        for key in (_email_key(email), _ip_key(ip)):
            self._failures.setdefault(key, deque()).append(now)

    def record_success(self, *, email: str) -> None:
        self._failures.pop(_email_key(email), None)

    def _recent(self, key: str, now: datetime) -> deque[datetime]:
        attempts = self._failures.get(key, deque())
        while attempts and now - attempts[0] >= _WINDOW:
            attempts.popleft()
        return attempts

    def _prune_if_large(self, now: datetime) -> None:
        if len(self._failures) < LOGIN_LIMITER_PRUNE_THRESHOLD:
            return
        self._failures = {key: v for key, v in self._failures.items() if self._recent(key, now)}


def _email_key(email: str) -> str:
    return f"email:{email.lower()}"


def _ip_key(ip: str) -> str:
    return f"ip:{ip}"
