"""FastAPI uygulama fabrikasi. Uvicorn: `uvicorn app.main:create_app --factory`."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.error_handlers import register_error_handlers
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.services.login_rate_limiter import LoginRateLimiter

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title="CampusFlow AI", version="0.1.0")
    # Route'lar ayarlari buradan okur (app/api/deps.py); testler kendi ayarlariyla uygulama kurar
    app.state.settings = settings
    app.state.login_limiter = LoginRateLimiter()
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
