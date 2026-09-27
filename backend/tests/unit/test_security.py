from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.security import (
    AccessTokenClaims,
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

SECRET = "test-secret-that-is-at-least-32-characters-long"
NOW = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)
TTL = timedelta(minutes=30)


# --- Parola ---


def test_password_is_stored_as_argon2_hash_not_plaintext() -> None:
    hashed = hash_password("cok-gizli-parola")

    assert hashed.startswith("$argon2id$")
    assert "cok-gizli-parola" not in hashed


def test_same_password_hashes_differently_each_time() -> None:
    # Tuz (salt) sayesinde ayni parola iki kullanicida ayni hash'i uretmez
    assert hash_password("ayni-parola") != hash_password("ayni-parola")


def test_correct_password_verifies() -> None:
    assert verify_password(hash_password("dogru-parola"), "dogru-parola") is True


def test_wrong_password_is_rejected() -> None:
    assert verify_password(hash_password("dogru-parola"), "yanlis-parola") is False


def test_garbage_hash_is_rejected_not_crashing() -> None:
    # Bozuk/eski formatta hash girise izin vermez; sessizce True donmez
    assert verify_password("duz-metin-parola", "duz-metin-parola") is False


# --- Access token (JWT) ---


def _token(**overrides: object) -> str:
    claims = AccessTokenClaims(
        user_id=int(overrides.get("user_id", 7)),  # type: ignore[call-overload]
        role=str(overrides.get("role", "REPORTER")),
    )
    return create_access_token(
        claims,
        secret=str(overrides.get("secret", SECRET)),
        ttl=TTL,
        now=NOW,
    )


def test_valid_token_roundtrip() -> None:
    claims = decode_access_token(_token(), secret=SECRET, now=NOW + timedelta(minutes=1))

    assert claims.user_id == 7
    assert claims.role == "REPORTER"


def test_expired_token_is_rejected() -> None:
    token = _token()

    with pytest.raises(InvalidTokenError):
        decode_access_token(token, secret=SECRET, now=NOW + TTL + timedelta(seconds=1))


def test_token_signed_with_another_secret_is_rejected() -> None:
    token = _token(secret="another-secret-that-is-also-32-characters-long")

    with pytest.raises(InvalidTokenError):
        decode_access_token(token, secret=SECRET, now=NOW)


def test_tampered_token_is_rejected() -> None:
    # Saldirgan payload'daki rolu ADMIN yapip imzayi oldugu gibi birakir
    header, _payload, signature = _token().split(".")
    forged_payload = jwt.utils.base64url_encode(
        b'{"sub":"7","role":"ADMIN","type":"access","iat":1790424000,"exp":1790425800}'
    ).decode()

    with pytest.raises(InvalidTokenError):
        decode_access_token(f"{header}.{forged_payload}.{signature}", secret=SECRET, now=NOW)


def test_unsigned_alg_none_token_is_rejected() -> None:
    # Klasik JWT saldirisi: imzasiz ("alg": "none") token
    unsigned = jwt.encode(
        {"sub": "7", "role": "ADMIN", "type": "access", "exp": NOW + TTL},
        key=None,
        algorithm="none",
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(unsigned, secret=SECRET, now=NOW)


def test_token_of_another_type_is_rejected() -> None:
    # Ayni anahtarla imzalanmis ama access olmayan bir token
    # (orn. ileride sifre sifirlama) kabul edilmez
    other = jwt.encode(
        {"sub": "7", "role": "REPORTER", "type": "reset", "exp": NOW + TTL},
        key=SECRET,
        algorithm="HS256",
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(other, secret=SECRET, now=NOW)


def test_garbage_string_is_rejected() -> None:
    with pytest.raises(InvalidTokenError):
        decode_access_token("bu-bir-token-degil", secret=SECRET, now=NOW)


# --- Refresh token ---


def test_refresh_tokens_are_random_and_long() -> None:
    tokens = {generate_refresh_token() for _ in range(50)}

    assert len(tokens) == 50
    assert all(len(token) >= 43 for token in tokens)  # 32 bayt rastgelelik, base64url


def test_refresh_token_is_stored_only_as_hash() -> None:
    token = generate_refresh_token()
    stored = hash_refresh_token(token)

    assert stored != token
    assert stored == hash_refresh_token(token)  # ayni token her zaman ayni hash: DB'de aranabilir
    assert len(stored) == 64  # sha256 hex
