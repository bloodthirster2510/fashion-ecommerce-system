FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 libgl1 libxcb1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.6.0 torchvision==0.21.0 \
    && pip install --no-cache-dir -r requirements.txt \
    && mkdir -p models \
    && python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo11n-pose.pt', 'models/yolo11n-pose.pt'); from ultralytics import YOLO; YOLO('models/yolo11n-pose.pt')"

COPY app ./app
COPY models ./models

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 7001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7001"]
