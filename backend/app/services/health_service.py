"""Saglik kontrolu: uygulama ayakta mi, veritabanina ulasiliyor mu."""

import logging
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.repositories import system_repository

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HealthReport:
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]


class HealthService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def check(self) -> HealthReport:
        # Yalnizca baglanti hatasi beklenir; karsiligi "degraded" raporudur (503)
        try:
            system_repository.ping(self._session)
        except OperationalError:
            logger.warning("database unreachable during health check")
            return HealthReport(status="degraded", database="unavailable")
        return HealthReport(status="ok", database="ok")
