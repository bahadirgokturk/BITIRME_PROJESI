"""Bildirim formu icin lokasyon listesi: tum roller, yalniz kendi kurumunun aktif lokasyonlari.

Yonetim (ekle/duzenle) /admin/locations altindadir ve yalniz ADMIN'e aciktir.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import Audit, CurrentUser
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.database import get_session
from app.schemas.common import Page, PageParams
from app.schemas.location import LocationOption
from app.services.location_service import LocationService

# Arama kutusu: konum adi icin fazlasiyla yeterli
LOCATION_QUERY_MAX_LENGTH = 100

router = APIRouter(prefix="/locations", tags=["locations"], responses=AUTHENTICATED_RESPONSES)


def get_location_service(
    session: Annotated[Session, Depends(get_session)], user: CurrentUser, auditor: Audit
) -> LocationService:
    # Bu route yalniz okur; denetim izi yalniz /admin degisikliklerinde yazilir
    return LocationService(session, user, auditor)


@router.get("")
def list_location_options(
    paging: Annotated[PageParams, Depends(page_params)],
    service: Annotated[LocationService, Depends(get_location_service)],
    q: Annotated[str | None, Query(max_length=LOCATION_QUERY_MAX_LENGTH)] = None,
) -> Page[LocationOption]:
    """`q`: ad, kod ve takma adlarda arama; Turkce karakter ve buyuk/kucuk harf farketmez."""
    return service.list_options(paging, q)
