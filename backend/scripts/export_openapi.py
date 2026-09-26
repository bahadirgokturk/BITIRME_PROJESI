"""OpenAPI semasini stdout'a yazar; frontend tipleri bundan uretilir (ADR-7).

Kullanim (backend/ icinden): uv run python -m scripts.export_openapi > openapi.json
"""

import json

from app.core.config import Settings
from app.main import create_app

# Sema uretimi DB'ye baglanmaz; URL yalnizca ayar dogrulamasi icin
_UNUSED_DATABASE_URL = "postgresql+psycopg://openapi:openapi@localhost:5432/openapi"
_UNUSED_JWT_SECRET = "openapi-export-does-not-sign-any-token-000"  # noqa: S105 - imza atilmaz


def main() -> None:
    app = create_app(Settings(database_url=_UNUSED_DATABASE_URL, jwt_secret=_UNUSED_JWT_SECRET))
    print(json.dumps(app.openapi(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
