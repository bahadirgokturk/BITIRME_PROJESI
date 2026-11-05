"""Seed komutu: python -m seeds.run [--demo [--history]]  (ayrinti: seeds/README.md).

Kampus sablonu her ortamda yuklenebilir. --demo bilinen parolali kullanicilar ekler; bu yuzden
production'da reddedilir ve parola repoda degil SEED_DEMO_PASSWORD ortam degiskenindedir.
"""

import argparse
import os
import sys
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime

from app.core.config import Environment, get_settings
from app.core.database import get_session_factory
from app.schemas.user import PASSWORD_MIN_LENGTH
from seeds.campus import SeedError, seed_campus, seed_demo_users
from seeds.history import HistoryPlan, seed_history

__all__ = ["SeedError", "demo_password", "main"]

DEMO_PASSWORD_VARIABLE = "SEED_DEMO_PASSWORD"  # noqa: S105 - degisken adi, parola degil


def demo_password(environment: Environment, env: Mapping[str, str]) -> str:
    if environment is Environment.PRODUCTION:
        raise SeedError("Demo kullanicilari production ortamina yuklenemez.")
    password = env.get(DEMO_PASSWORD_VARIABLE, "")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise SeedError(
            f"{DEMO_PASSWORD_VARIABLE} ortam degiskeni en az {PASSWORD_MIN_LENGTH} karakter olmali."
        )
    return password


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CampusFlow seed (idempotent)")
    parser.add_argument("--demo", action="store_true", help="demo kullanicilarini da ekle")
    parser.add_argument(
        "--history",
        action="store_true",
        help="--demo ile: son 60 gunun bildirimlerini gercek agent hattindan gecirerek uret",
    )
    args = parser.parse_args(argv)
    if args.history and not args.demo:
        print("Seed hatasi: --history yalniz --demo ile kullanilir.", file=sys.stderr)
        return 1
    try:
        # Ortam kontrolu DB'ye dokunmadan once yapilir
        password = demo_password(get_settings().environment, os.environ) if args.demo else None
        with get_session_factory()() as session:
            organization = seed_campus(session)
            created = seed_demo_users(session, organization, password) if password else 0
            session.commit()
            if args.history and password:
                # Birkac dakika surer: her bildirim agent hattindan gecer
                history = seed_history(
                    session, organization, password, HistoryPlan(end=datetime.now(UTC))
                )
                print(f"Gecmis: {history.created} bildirim, {history.open} acik")
    except SeedError as error:
        print(f"Seed hatasi: {error}", file=sys.stderr)
        return 1
    print(f"Kampus sablonu yuklendi: {organization.name}. Yeni demo kullanicisi: {created}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
