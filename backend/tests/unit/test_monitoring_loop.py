"""Izleme dongusu (E5-10): her aralikta bir tur; gecici veritabani hatasi donguyu durdurmaz."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import OperationalError

from app.services import monitoring_service

TICK = timedelta(milliseconds=5)
# Dongu takilirsa test sonsuza kadar beklemesin
WAIT_LIMIT_SECONDS = 2


class _Clock:
    def now(self) -> datetime:
        return datetime(2026, 10, 7, tzinfo=UTC)


async def _run_for(ticks: int, calls: list[int]) -> None:
    loop = asyncio.create_task(
        monitoring_service.monitoring_loop(object(), _Clock(), TICK, True)  # type: ignore[arg-type]
    )

    async def enough() -> None:
        while len(calls) < ticks and not loop.done():
            await asyncio.sleep(TICK.total_seconds())

    await asyncio.wait_for(enough(), timeout=WAIT_LIMIT_SECONDS)
    assert not loop.done(), "dongu durdu"
    loop.cancel()
    with pytest.raises(asyncio.CancelledError):
        await loop


def test_the_loop_ticks_repeatedly(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[int] = []
    monkeypatch.setattr(monitoring_service, "_tick_once", lambda *_: calls.append(1))

    asyncio.run(_run_for(3, calls))

    assert len(calls) >= 3


def test_a_database_error_does_not_stop_the_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[int] = []

    def failing(*_: object) -> None:
        calls.append(1)
        raise OperationalError("SELECT 1", {}, Exception("baglanti koptu"))

    monkeypatch.setattr(monitoring_service, "_tick_once", failing)

    asyncio.run(_run_for(2, calls))

    assert len(calls) >= 2
