# Tek imaj: yerelde docker-compose kendi komutunu (--reload) verir; Render bu CMD ile baslatir.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /bin/

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .

EXPOSE 8000
# Render (staging/production): ucretsiz planda deploy oncesi komut yok; migration acilista calisir
# (alembic upgrade idempotent). Port Render'in PORT degiskeninden gelir; proxy basliklari https'i
# dogru gosterir (Secure cerez). exec: uvicorn sinyalleri dogrudan alir, kapanis temiz olur
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
