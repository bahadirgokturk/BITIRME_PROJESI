"""Dahili uclar: kullanici degil, zamanlanmis is (GitHub Actions) cagirir.

Render'in ucretsiz sunucusu 15 dk bostayken uyur ve uygulama icindeki izleme dongusu durur
(docs/DEPLOYMENT.md 1.1). Dis tetikleyici mesai saatlerinde turu calistirir; sunucu da uyanik kalir.
Anahtar tanimli degilse uc yokmus gibi 404 doner.
"""

import hmac
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.api.deps import get_app_settings
from app.core import messages
from app.core.clock import Clock, get_clock
from app.core.config import Settings
from app.core.database import get_engine
from app.core.errors import NotFoundError, UnauthorizedError
from app.schemas.internal import MonitoringRunRead
from app.services.monitoring_service import tick_once

router = APIRouter(prefix="/internal", tags=["internal"])
MonitoringRun = Callable[[], bool]


def get_monitoring_run(
    settings: Annotated[Settings, Depends(get_app_settings)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> MonitoringRun:
    # Kilit oturum seviyesinde: tur, istegin oturumunda degil kendi tek baglantisinda calisir
    return lambda: tick_once(get_engine(), clock, settings.agents_enabled)


def _check_token(settings: Settings, given: str | None) -> None:
    if settings.internal_token is None:
        raise NotFoundError()
    expected = settings.internal_token.get_secret_value()
    # Sabit sureli karsilastirma: yanit suresinden anahtar tahmin edilemez
    if given is None or not hmac.compare_digest(given.encode(), expected.encode()):
        raise UnauthorizedError(messages.INTERNAL_TOKEN_INVALID)


@router.post("/monitoring/run")
def run_monitoring(
    settings: Annotated[Settings, Depends(get_app_settings)],
    run: Annotated[MonitoringRun, Depends(get_monitoring_run)],
    token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
) -> MonitoringRunRead:
    """Bir izleme turu (SLA uyari/asim, takilan analiz...); `ran` false: tur baska sunucuda."""
    _check_token(settings, token)
    return MonitoringRunRead(ran=run())
