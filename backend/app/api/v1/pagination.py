from dataclasses import dataclass
from typing import Annotated

from fastapi import Query

from app.core.constants import PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX


@dataclass(frozen=True)
class PageParams:
    page: int
    page_size: int


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)
