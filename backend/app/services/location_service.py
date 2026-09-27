"""Admin lokasyon yonetimi: Kampus -> Bina -> Kat -> Alan agaci (docs/DATABASE.md "locations").

path (materialized path) sunucuda hesaplanir: ebeveynin path'i + "/" + kod. Bir lokasyon
tasininca tum alt agacin path'i ayni islemde guncellenir; kendi altina tasinamaz (dongu).
"""

from sqlalchemy.orm import Session

from app.core import messages
from app.core.errors import ConflictError, InvalidParentError, NotFoundError
from app.models import Location, User
from app.repositories import location_repository
from app.repositories.location_repository import PATH_SEPARATOR
from app.schemas.common import Page, PageParams
from app.schemas.location import LocationCreate, LocationOption, LocationRead, LocationUpdate
from app.services.authorization import ensure_same_organization


class LocationService:
    def __init__(self, session: Session, actor: User) -> None:
        self._session = session
        self._actor = actor

    def list(self, paging: PageParams) -> Page[LocationRead]:
        items, total = location_repository.list_page(
            self._session, self._actor.organization_id, paging
        )
        return Page(
            items=[LocationRead.model_validate(loc, from_attributes=True) for loc in items],
            total=total,
            page=paging.page,
        )

    def list_options(self, paging: PageParams) -> Page[LocationOption]:
        """Bildirim formu icin: yalniz aktif lokasyonlar, her rol icin."""
        items, total = location_repository.list_active_page(
            self._session, self._actor.organization_id, paging
        )
        return Page(
            items=[LocationOption.model_validate(loc, from_attributes=True) for loc in items],
            total=total,
            page=paging.page,
        )

    def create(self, data: LocationCreate) -> LocationRead:
        organization_id = self._actor.organization_id
        if location_repository.get_by_code(self._session, organization_id, data.code):
            raise ConflictError(messages.DUPLICATE_CODE)
        location = Location(
            organization_id=organization_id,
            **data.model_dump(),
            path=self._path_under(data.parent_id, data.code),
        )
        location_repository.add(self._session, location)
        self._session.commit()
        return LocationRead.model_validate(location, from_attributes=True)

    def update(self, location_id: int, data: LocationUpdate) -> LocationRead:
        location = self._get(location_id)
        changes = data.model_dump(exclude_unset=True)
        # parent_id: null bilincli bir secimdir (koke tasi); diger alanlarda null "degistirme"
        if "parent_id" in changes:
            self._move(location, changes.pop("parent_id"))
        for field, value in changes.items():
            if value is not None:
                setattr(location, field, value)
        self._session.commit()
        return LocationRead.model_validate(location, from_attributes=True)

    def _move(self, location: Location, parent_id: int | None) -> None:
        old_path = location.path
        if parent_id is not None:
            parent = self._get(parent_id)
            if parent.path == old_path or parent.path.startswith(old_path + PATH_SEPARATOR):
                raise InvalidParentError()
        location.parent_id = parent_id
        location.path = self._path_under(parent_id, location.code)
        location_repository.move_descendants(
            self._session, location.organization_id, old_path, location.path
        )

    def _path_under(self, parent_id: int | None, code: str) -> str:
        if parent_id is None:
            return code
        return self._get(parent_id).path + PATH_SEPARATOR + code

    def _get(self, location_id: int) -> Location:
        location = location_repository.get(self._session, location_id)
        if location is None:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=location.organization_id)
        return location
