from typing import Literal

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenRead(BaseModel):
    # Refresh token yanitta degil, httpOnly cookie'de doner (docs/ARCHITECTURE.md bolum 9)
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 - OAuth2 token tipi, parola degil
    expires_in: int
