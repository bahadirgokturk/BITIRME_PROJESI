from dataclasses import dataclass

from pydantic import BaseModel


@dataclass(frozen=True)
class PageParams:
    """Liste istegi: ?page=1&page_size=20 (docs/API.md).

    Servisler de kullanir; bu yuzden api/ katmaninda degil burada tanimli.
    """

    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page[T](BaseModel):
    """Liste yaniti: {"items": [...], "total": 0, "page": 1} (docs/API.md)."""

    items: list[T]
    total: int
    page: int
