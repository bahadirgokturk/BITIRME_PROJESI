"""Parola hash'i, JWT access token ve refresh token primitifleri.

Is kurali (giris, rotasyon, iptal) burada degil services/auth_service.py'de olur.
Zaman parametre olarak verilir (Clock enjeksiyonu, docs/CONVENTIONS.md) ki sure dolumu
testte sabitlenebilsin.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2id, kutuphanenin OWASP uyumlu varsayilan parametreleriyle
_password_hasher = PasswordHasher()

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"  # noqa: S105 - JWT "type" claim degeri, parola degil
# 32 bayt = 256 bit rastgelelik; tahmin edilemez
REFRESH_TOKEN_BYTES = 32


class InvalidTokenError(Exception):
    """Token gecersiz, suresi dolmus, imzasi bozuk ya da yanlis turde."""


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: int
    role: str


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    # Yalniz beklenen iki hata yakalanir: yanlis parola ve taninmayan hash formati
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(
    claims: AccessTokenClaims, *, secret: str, ttl: timedelta, now: datetime
) -> str:
    payload = {
        "sub": str(claims.user_id),
        "role": claims.role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, *, secret: str, now: datetime) -> AccessTokenClaims:
    # Algoritma sabit listeden secilir: "alg": "none" ve algoritma degistirme
    # saldirilari reddedilir.
    # Sure kontrolu kutuphane saatine degil verilen "now"a gore yapilir.
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "role", "type", "exp"], "verify_exp": False},
        )
    except jwt.PyJWTError as error:
        raise InvalidTokenError(str(error)) from error
    if claims["type"] != ACCESS_TOKEN_TYPE:
        raise InvalidTokenError("token tipi access degil")
    if now.timestamp() >= claims["exp"]:
        raise InvalidTokenError("token suresi dolmus")
    return AccessTokenClaims(user_id=int(claims["sub"]), role=str(claims["role"]))


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(REFRESH_TOKEN_BYTES)


def hash_refresh_token(token: str) -> str:
    # Refresh token yuksek entropili rastgele deger: yavas hash (argon2) gerekmez, sha256 yeterli
    # ve DB'de esitlikle aranabilir. DB sizsa bile ham token elde edilemez.
    return hashlib.sha256(token.encode()).hexdigest()
