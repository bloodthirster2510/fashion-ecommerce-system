FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV GARMENT_PROCESSING_PROVIDER=hybrid
ENV GARMENT_MODEL_CACHE_DIR=/app/models/huggingface
ENV GARMENT_MODEL_LOCAL_FILES_ONLY=true
ENV GARMENT_MODEL_WARMUP_ON_START=true

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.6.0 torchvision==0.21.0 \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

RUN python scripts/download_models.py

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 7002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7002"]
