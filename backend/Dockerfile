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

# Fotograf onerisi (Vision Agent): CLIP goruntu modeli repoda degil (89 MB). Sabit surum indirilir,
# SHA-256 tutmazsa imaj kurulmaz. Degerler ml_models/vision/v1/manifest.json ile ayni (testte denetlenir)
ARG CLIP_URL=https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/6b7c523703ae26e39be4b03774966f8571c7f523/onnx/vision_model_quantized.onnx
ARG CLIP_SHA256=583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299
RUN mkdir -p /opt/models && python -c "import hashlib, sys, urllib.request; data = urllib.request.urlopen(sys.argv[1], timeout=300).read(); assert hashlib.sha256(data).hexdigest() == sys.argv[2], 'CLIP modeli SHA-256 tutmuyor'; open('/opt/models/clip-vision-int8.onnx', 'wb').write(data)" "$CLIP_URL" "$CLIP_SHA256"

COPY . .

EXPOSE 8000
# Render (staging/production): ucretsiz planda deploy oncesi komut yok; migration acilista calisir
# (alembic upgrade idempotent). Port Render'in PORT degiskeninden gelir; proxy basliklari https'i
# dogru gosterir (Secure cerez). exec: uvicorn sinyalleri dogrudan alir, kapanis temiz olur
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
