"""Production ilk yonetici: demo kullanicilari production'a yuklenemez (seeds.run), bu yuzden ilk
ADMIN bu komutla acilir; digerlerini o yonetici ekrandan ekler.

Parola komut satirina yazilmaz (kabuk gecmisinde kalir): ADMIN_PASSWORD ortam degiskeni ya da iki
kez sorulur. Kurulum (repo kokunden, Neon adresi yalniz kendi terminalinizde):
    docker compose run --rm -it -e ENVIRONMENT=production -e DATABASE_URL="<Neon adresi>" \
        -e JWT_SECRET="<32+ karakter>" backend sh -c "alembic upgrade head && \
        python -m seeds.run && python -m scripts.create_admin --email <e-posta> --name '<Ad>'"
"""

import argparse
import getpass
import os
import sys
from collections.abc import Callable, Mapping

from sqlalchemy.orm import Session

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import User
from app.models.enums import UserRole
from app.repositories import organization_repository, user_repository
from app.schemas.user import PASSWORD_MIN_LENGTH

PASSWORD_VARIABLE = "ADMIN_PASSWORD"  # noqa: S105 - degisken adi, parola degil


class AdminSetupError(Exception):
    pass


def read_password(env: Mapping[str, str], prompt: Callable[[str], str]) -> str:
    if env.get(PASSWORD_VARIABLE):
        return env[PASSWORD_VARIABLE]
    first = prompt("Parola: ")
    if prompt("Parola (tekrar): ") != first:
        raise AdminSetupError("Parolalar eslesmiyor.")
    return first


def create_admin(session: Session, email: str, full_name: str, password: str) -> User:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise AdminSetupError(f"Parola en az {PASSWORD_MIN_LENGTH} karakter olmali.")
    organizations = organization_repository.list_all(session)
    if len(organizations) != 1:
        raise AdminSetupError(
            "Tek kurum bekleniyordu; once kampus sablonunu yukleyin: python -m seeds.run"
        )
    if user_repository.get_by_email(session, email) is not None:
        raise AdminSetupError(f"{email} zaten kayitli; mevcut hesap degistirilmez.")
    user = User(
        organization_id=organizations[0].id,
        email=email.strip().lower(),
        password_hash=hash_password(password),
        full_name=full_name,
        role=UserRole.ADMIN,
    )
    session.add(user)
    session.flush()
    return user


def main() -> int:
    parser = argparse.ArgumentParser(description="Production ilk yonetici hesabi")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True, help="Ekranda gorunen ad")
    args = parser.parse_args()
    try:
        password = read_password(os.environ, getpass.getpass)
        with get_session_factory()() as session:
            user = create_admin(session, args.email, args.name, password)
            session.commit()
    except AdminSetupError as error:
        print(f"Yonetici acilamadi: {error}", file=sys.stderr)
        return 1
    print(f"Yonetici acildi: {user.email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
