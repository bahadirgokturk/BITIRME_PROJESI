"""Lokasyon agacinda bina / kat / alan seviyesine toplama (docs/ANALYTICS.md "Lokasyon analizi").

Agacin derinligi her yerde ayni degil (bahce kampusun dogrudan alt dugumu, yemekhanede kat yok);
seviye derinlikten degil turden (kind) bulunur:
- bina: yolu ustundeki BUILDING; yoksa kampusun dogrudan alt dugumu (bahce, otopark)
- kat: yolu ustundeki FLOOR; yoksa binasi
- alan: lokasyonun kendisi
"""

from collections.abc import Callable

from app.models import Location
from app.models.enums import LocationKind
from app.schemas.analytics import LocationLevel

# Kok (kampus) + bir alt seviye: bina disi alanlarin grup dugumu
_TOP_LEVEL_DEPTH = 2


class LocationTree:
    def __init__(self, locations: list[Location]) -> None:
        self._by_path = {location.path: location for location in locations}

    def group_of(self, location: Location, level: LocationLevel) -> Location:
        return _GROUPERS[level](self, location)

    def _ancestors(self, location: Location) -> list[Location]:
        """Kokten kendisine kadar (kendisi dahil)."""
        parts = location.path.split("/")
        paths = ("/".join(parts[: depth + 1]) for depth in range(len(parts)))
        return [self._by_path[path] for path in paths if path in self._by_path]

    def _first_of_kind(self, location: Location, kind: LocationKind) -> Location | None:
        return next((node for node in self._ancestors(location) if node.kind is kind), None)

    def _building(self, location: Location) -> Location:
        found = self._first_of_kind(location, LocationKind.BUILDING)
        if found is not None:
            return found
        ancestors = self._ancestors(location)
        return ancestors[min(_TOP_LEVEL_DEPTH, len(ancestors)) - 1]

    def _floor(self, location: Location) -> Location:
        return self._first_of_kind(location, LocationKind.FLOOR) or self._building(location)

    def _area(self, location: Location) -> Location:
        return location


_GROUPERS: dict[LocationLevel, Callable[[LocationTree, Location], Location]] = {
    LocationLevel.BUILDING: LocationTree._building,
    LocationLevel.FLOOR: LocationTree._floor,
    LocationLevel.AREA: LocationTree._area,
}
