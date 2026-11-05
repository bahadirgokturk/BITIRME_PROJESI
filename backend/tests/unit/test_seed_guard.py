"""Demo seed korumasi: demo kullanicilari (bilinen parola) canli ortama yuklenemez."""

import pytest

from app.core.config import Environment
from seeds.run import SeedError, demo_password


def test_demo_is_refused_in_production() -> None:
    with pytest.raises(SeedError):
        demo_password(Environment.PRODUCTION, {"SEED_DEMO_PASSWORD": "demo-parola-123"})


def test_demo_needs_a_password_from_the_environment() -> None:
    with pytest.raises(SeedError):
        demo_password(Environment.LOCAL, {})


def test_demo_password_must_meet_the_minimum_length() -> None:
    with pytest.raises(SeedError):
        demo_password(Environment.LOCAL, {"SEED_DEMO_PASSWORD": "kisa"})


def test_demo_password_is_read_from_the_environment() -> None:
    password = demo_password(Environment.STAGING, {"SEED_DEMO_PASSWORD": "demo-parola-123"})

    assert password == "demo-parola-123"
