from datetime import UTC, datetime, timedelta

import pytest

from app.core.constants import (
    LOGIN_FAILURE_WINDOW_MINUTES,
    LOGIN_MAX_FAILURES_PER_EMAIL,
    LOGIN_MAX_FAILURES_PER_IP,
)
from app.core.errors import TooManyRequestsError
from app.services.login_rate_limiter import LoginRateLimiter

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)
IP = "203.0.113.7"


def _fail(limiter: LoginRateLimiter, times: int, email: str = "a@x.edu.tr", ip: str = IP) -> None:
    for _ in range(times):
        limiter.check(email=email, ip=ip, now=NOW)
        limiter.record_failure(email=email, ip=ip, now=NOW)


def test_allows_attempts_up_to_the_email_limit() -> None:
    limiter = LoginRateLimiter()

    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL)


def test_blocks_the_email_after_too_many_failures() -> None:
    limiter = LoginRateLimiter()
    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL)

    with pytest.raises(TooManyRequestsError) as caught:
        limiter.check(email="a@x.edu.tr", ip="198.51.100.1", now=NOW)

    assert caught.value.retry_after_seconds == LOGIN_FAILURE_WINDOW_MINUTES * 60


def test_email_limit_is_case_insensitive() -> None:
    limiter = LoginRateLimiter()
    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL)

    with pytest.raises(TooManyRequestsError):
        limiter.check(email="A@X.EDU.TR", ip="198.51.100.1", now=NOW)


def test_other_emails_are_not_blocked_by_one_email() -> None:
    limiter = LoginRateLimiter()
    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL)

    limiter.check(email="b@x.edu.tr", ip="198.51.100.1", now=NOW)


def test_blocks_an_ip_spraying_many_emails() -> None:
    # Saldirgan her e-postayi az deneyerek e-posta sinirinin altinda kalmaya calisir
    limiter = LoginRateLimiter()
    for index in range(LOGIN_MAX_FAILURES_PER_IP):
        _fail(limiter, 1, email=f"user{index}@x.edu.tr")

    with pytest.raises(TooManyRequestsError):
        limiter.check(email="yeni@x.edu.tr", ip=IP, now=NOW)


def test_block_expires_after_the_window() -> None:
    limiter = LoginRateLimiter()
    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL)
    later = NOW + timedelta(minutes=LOGIN_FAILURE_WINDOW_MINUTES, seconds=1)

    limiter.check(email="a@x.edu.tr", ip=IP, now=later)


def test_successful_login_resets_the_email_counter() -> None:
    limiter = LoginRateLimiter()
    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL - 1)

    limiter.record_success(email="a@x.edu.tr")
    _fail(limiter, LOGIN_MAX_FAILURES_PER_EMAIL - 1)
