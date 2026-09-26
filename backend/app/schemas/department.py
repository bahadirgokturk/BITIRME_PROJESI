from pydantic import BaseModel, Field


class DepartmentRead(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool


class DepartmentCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50, pattern=r"^[A-Z0-9_]+$")
    name: str = Field(min_length=1, max_length=200)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None
