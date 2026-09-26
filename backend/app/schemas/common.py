from pydantic import BaseModel


class Page[T](BaseModel):
    """Liste yaniti: {"items": [...], "total": 0, "page": 1} (docs/API.md)."""

    items: list[T]
    total: int
    page: int
