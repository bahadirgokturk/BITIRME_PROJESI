from typing import Annotated

from fastapi import Query

from app.core.constants import PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX
from app.schemas.common import PageParams


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)
