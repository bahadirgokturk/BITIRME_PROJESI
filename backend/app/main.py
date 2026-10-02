"""FastAPI uygulama fabrikasi. Uvicorn: `uvicorn app.main:create_app --factory`."""

import asyncio
import contextlib
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.error_handlers import register_error_handlers
from app.api.v1.router import api_router
from app.core.clock import SystemClock
from app.core.config import Settings, get_settings
from app.core.database import get_engine
from app.core.logging import configure_logging
from app.services.login_rate_limiter import LoginRateLimiter
from app.services.monitoring_service import monitoring_loop
from app.storage import LocalStorage

API_PREFIX = "/api/v1"


def _lifespan(settings: Settings) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if not settings.monitoring_enabled:
            yield
            return
        # Monitoring Agent (E5-10): uygulama acikken arka planda periyodik tur
        loop = asyncio.create_task(
            monitoring_loop(
                get_engine(),
                SystemClock(),
                timedelta(seconds=settings.monitoring_interval_seconds),
                settings.agents_enabled,
            )
        )
        yield
        loop.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await loop

    return lifespan


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title="CampusFlow AI", version="0.1.0", lifespan=_lifespan(settings))
    # Route'lar ayarlari buradan okur (app/api/deps.py); testler kendi ayarlariyla uygulama kurar
    app.state.settings = settings
    app.state.login_limiter = LoginRateLimiter()
    app.state.storage = LocalStorage(Path(settings.storage_local_path))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(api_router, prefix=API_PREFIX)
    return app
