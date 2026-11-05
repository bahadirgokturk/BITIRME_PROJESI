from collections.abc import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Location
from app.schemas.common import PageParams

PATH_SEPARATOR = "/"


def list_page(
    session: Session, organization_id: int, paging: PageParams
) -> tuple[Sequence[Location], int]:
    # path siralamasi agaci ebeveyn-cocuk sirasiyla verir (KMP, KMP/B, KMP/B/B-1, KMP/C)
    scope = select(Location).where(Location.organization_id == organization_id)
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(Location.path).offset(paging.offset).limit(paging.page_size)
    ).all()
    return items, total


def get(session: Session, location_id: int) -> Location | None:
    return session.get(Location, location_id)


def get_by_code(session: Session, organization_id: int, code: str) -> Location | None:
    return session.scalars(
        select(Location).where(Location.organization_id == organization_id, Location.code == code)
    ).one_or_none()


def add(session: Session, location: Location) -> Location:
    session.add(location)
    session.flush()
    return location


def move_descendants(session: Session, organization_id: int, old_path: str, new_path: str) -> None:
    """Alt agacin tum yollarini yeni ebeveyne gore gunceller (tek SQL)."""
    prefix = old_path + PATH_SEPARATOR
    session.execute(
        update(Location)
        .where(
            Location.organization_id == organization_id,
            # autoescape: koddaki % ve _ karakterleri LIKE joker karakteri sayilmaz
            Location.path.startswith(prefix, autoescape=True),
        )
        .values(path=new_path + PATH_SEPARATOR + func.substr(Location.path, len(prefix) + 1))
        .execution_options(synchronize_session="fetch")
    )


def list_active(session: Session, organization_id: int) -> Sequence[Location]:
    return session.scalars(
        select(Location)
        .where(Location.organization_id == organization_id, Location.is_active.is_(True))
        .order_by(Location.path)
    ).all()


def list_active_page(
    session: Session, organization_id: int, paging: PageParams
) -> tuple[Sequence[Location], int]:
    scope = select(Location).where(
        Location.organization_id == organization_id, Location.is_active.is_(True)
    )
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(Location.path).offset(paging.offset).limit(paging.page_size)
    ).all()
    return items, total
