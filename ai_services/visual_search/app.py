import hashlib
import io
import os
import threading
from typing import Optional

import numpy as np
import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from PIL import Image


app = FastAPI(title="Fashion Visual Search Embedding Service")

MODEL_NAME = os.getenv("VISUAL_EMBEDDING_MODEL", "openfashionclip")
MODEL_VERSION = os.getenv("VISUAL_EMBEDDING_VERSION", "v2")
BACKEND = os.getenv("VISUAL_EMBEDDING_BACKEND", "mock").lower()
MOCK_DIMENSION = int(os.getenv("VISUAL_EMBEDDING_MOCK_DIMENSION", "64"))
DOWNLOAD_TIMEOUT_SECONDS = float(os.getenv("VISUAL_IMAGE_DOWNLOAD_TIMEOUT_SECONDS", "15"))
OPEN_CLIP_MODEL = os.getenv("VISUAL_OPEN_CLIP_MODEL", "ViT-B-32")
OPEN_CLIP_PRETRAINED = os.getenv(
    "VISUAL_OPEN_CLIP_PRETRAINED",
    "hf-hub:Marqo/marqo-fashionCLIP",
)
EMBEDDING_DEVICE = os.getenv("VISUAL_EMBEDDING_DEVICE", "auto").lower()
REAL_MODEL_BACKENDS = {"open_clip", "openfashionclip", "fashionclip"}

_open_clip_lock = threading.Lock()
_open_clip_runtime = None


class ImageUrlRequest(BaseModel):
    imageUrl: str
    imageHash: Optional[str] = None
    model: Optional[str] = None
    modelVersion: Optional[str] = None


class TextRequest(BaseModel):
    text: str
    model: Optional[str] = None
    modelVersion: Optional[str] = None


# Chuẩn hóa vector để việc so sánh giữa các ảnh ổn định hơn.
def normalize(vector: np.ndarray) -> list[float]:
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        return vector.astype(float).tolist()
    return (vector / norm).round(8).astype(float).tolist()


# Đọc bytes ảnh thành ảnh RGB, giúp mock model và model thật nhận cùng định dạng.
def read_image(image_bytes: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Không thể đọc ảnh đầu vào.") from exc


def create_mock_embedding(image_bytes: bytes, seed_hint: str = "") -> list[float]:
    """Tạo embedding ổn định để kiểm tra pipeline khi chưa bật model thật."""
    image = read_image(image_bytes).resize((32, 32))
    pixels = np.asarray(image).astype(np.float32) / 255.0
    channel_means = pixels.mean(axis=(0, 1))
    channel_stds = pixels.std(axis=(0, 1))
    digest = hashlib.sha512(image_bytes + seed_hint.encode("utf-8")).digest()
    hashed_values = np.frombuffer(digest, dtype=np.uint8).astype(np.float32)
    repeated_hash = np.resize(hashed_values / 127.5 - 1.0, MOCK_DIMENSION)
    color_features = np.resize(np.concatenate([channel_means, channel_stds]), MOCK_DIMENSION)
    vector = repeated_hash * 0.7 + color_features * 0.3
    return normalize(vector)


def create_mock_text_embedding(text: str) -> list[float]:
    """Tạo text embedding giả lập để kiểm thử luồng text-to-image."""
    digest = hashlib.sha512(text.strip().lower().encode("utf-8")).digest()
    hashed_values = np.frombuffer(digest, dtype=np.uint8).astype(np.float32)
    vector = np.resize(hashed_values / 127.5 - 1.0, MOCK_DIMENSION)
    return normalize(vector)


# Chọn CPU hoặc GPU cho model thật, tùy cấu hình máy chạy service.
def get_torch_device():
    try:
        import torch
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Thiếu dependency torch. Hãy cài requirements-model.txt để chạy model thật.",
        ) from exc

    if EMBEDDING_DEVICE == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"

    return EMBEDDING_DEVICE


# Một số model trên HuggingFace Hub, như Marqo FashionCLIP, cần truyền
# trực tiếp "hf-hub:..." vào tham số model thay vì pretrained.
def get_open_clip_load_args() -> dict:
    if OPEN_CLIP_MODEL.startswith("hf-hub:"):
        return {"model_name": OPEN_CLIP_MODEL}

    if OPEN_CLIP_PRETRAINED.startswith("hf-hub:"):
        return {"model_name": OPEN_CLIP_PRETRAINED}

    return {
        "model_name": OPEN_CLIP_MODEL,
        "pretrained": OPEN_CLIP_PRETRAINED or None,
    }


# Load FashionCLIP/OpenCLIP một lần, sau đó dùng lại để tránh tải model nhiều lần.
def load_open_clip_runtime():
    global _open_clip_runtime

    if _open_clip_runtime is not None:
        return _open_clip_runtime

    with _open_clip_lock:
        if _open_clip_runtime is not None:
            return _open_clip_runtime

        try:
            import open_clip
            import torch
        except ImportError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Thiếu dependency open_clip/torch. "
                    "Hãy cài requirements-model.txt để chạy FashionCLIP/OpenFashionCLIP."
                ),
            ) from exc

        device = get_torch_device()
        load_args = get_open_clip_load_args()

        try:
            model, _, preprocess = open_clip.create_model_and_transforms(
                **load_args,
                device=device,
            )
            tokenizer = open_clip.get_tokenizer(load_args["model_name"])
        except Exception as exc:
            print(
                "OpenCLIP load failed:",
                {
                    "openClipModel": OPEN_CLIP_MODEL,
                    "openClipPretrained": OPEN_CLIP_PRETRAINED,
                    "loadArgs": load_args,
                    "error": repr(exc),
                },
                flush=True,
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    "Không thể load OpenCLIP/FashionCLIP. "
                    f"Lỗi gốc: {exc}"
                ),
            ) from exc

        model.eval()
        _open_clip_runtime = {
            "model": model,
            "preprocess": preprocess,
            "tokenizer": tokenizer,
            "torch": torch,
            "device": device,
            "loadArgs": load_args,
        }
        return _open_clip_runtime


# Tạo embedding bằng model thật cho ảnh đầu vào.
def create_open_clip_embedding(image_bytes: bytes) -> list[float]:
    runtime = load_open_clip_runtime()
    image = read_image(image_bytes)
    image_tensor = runtime["preprocess"](image).unsqueeze(0).to(runtime["device"])

    with runtime["torch"].no_grad():
        features = runtime["model"].encode_image(image_tensor)
        features = features / features.norm(dim=-1, keepdim=True)

    vector = features.squeeze(0).detach().cpu().numpy().astype(np.float32)
    return normalize(vector)


def create_open_clip_text_embedding(text: str) -> list[float]:
    runtime = load_open_clip_runtime()
    tokens = runtime["tokenizer"]([text]).to(runtime["device"])

    with runtime["torch"].no_grad():
        features = runtime["model"].encode_text(tokens)
        features = features / features.norm(dim=-1, keepdim=True)

    vector = features.squeeze(0).detach().cpu().numpy().astype(np.float32)
    return normalize(vector)


# Chọn backend tạo embedding: mock để kiểm thử nhanh, hoặc model thật khi triển khai.
def create_embedding(image_bytes: bytes, seed_hint: str = "") -> list[float]:
    if BACKEND in REAL_MODEL_BACKENDS:
        return create_open_clip_embedding(image_bytes)

    if BACKEND != "mock":
        raise HTTPException(
            status_code=400,
            detail="VISUAL_EMBEDDING_BACKEND chỉ hỗ trợ mock hoặc open_clip.",
        )

    return create_mock_embedding(image_bytes, seed_hint)


def create_text_embedding(text: str) -> list[float]:
    if BACKEND in REAL_MODEL_BACKENDS:
        return create_open_clip_text_embedding(text)

    if BACKEND != "mock":
        raise HTTPException(
            status_code=400,
            detail="VISUAL_EMBEDDING_BACKEND chỉ hỗ trợ mock hoặc open_clip.",
        )

    return create_mock_text_embedding(text)


# Chuẩn hóa response trả về cho backend Node.js lưu vào index.
def response_payload(embedding: list[float]) -> dict:
    return {
        "embedding": embedding,
        "embeddingDimension": len(embedding),
        "embeddingModel": MODEL_NAME,
        "embeddingVersion": MODEL_VERSION,
        "backend": BACKEND,
    }


# Đổi lỗi ngoài dự kiến thành response rõ ràng để backend Node không chỉ nhận 500 chung chung.
def handle_embedding_runtime_error(exc: Exception):
    if isinstance(exc, HTTPException):
        raise exc

    print("Embedding runtime failed:", repr(exc), flush=True)
    raise HTTPException(
        status_code=500,
        detail=f"Lỗi khi tạo embedding: {exc}",
    ) from exc


# Kiểm tra service còn sống và model thật đã được load hay chưa.
@app.get("/health")
def health() -> dict:
    model_loaded = _open_clip_runtime is not None

    return {
        "status": "ok",
        "model": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "backend": BACKEND,
        "modelLoaded": model_loaded,
        "openClipModel": OPEN_CLIP_MODEL if BACKEND in REAL_MODEL_BACKENDS else None,
        "openClipPretrained": OPEN_CLIP_PRETRAINED if BACKEND in REAL_MODEL_BACKENDS else None,
        "openClipLoadArgs": _open_clip_runtime["loadArgs"] if model_loaded else get_open_clip_load_args(),
        "device": _open_clip_runtime["device"] if model_loaded else EMBEDDING_DEVICE,
    }


# Dùng cho backfill: tải ảnh sản phẩm theo URL rồi tạo embedding.
@app.post("/embed/image-url")
def embed_image_url(payload: ImageUrlRequest) -> dict:
    try:
        response = requests.get(payload.imageUrl, timeout=DOWNLOAD_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail="Không thể tải ảnh từ URL.") from exc

    try:
        embedding = create_embedding(response.content, payload.imageHash or payload.imageUrl)
    except Exception as exc:
        handle_embedding_runtime_error(exc)

    return response_payload(embedding)


# Dùng cho người dùng upload ảnh trực tiếp khi tìm kiếm sản phẩm.
@app.post("/embed/image")
async def embed_image(file: UploadFile = File(...)) -> dict:
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="File ảnh rỗng.")

    try:
        embedding = create_embedding(image_bytes, file.filename or "")
    except Exception as exc:
        handle_embedding_runtime_error(exc)

    return response_payload(embedding)


# Dùng cho text-to-image search: mã hóa câu mô tả vào cùng không gian embedding với ảnh sản phẩm.
@app.post("/embed/text")
def embed_text(payload: TextRequest) -> dict:
    text = payload.text.strip()
    if len(text) < 2:
        raise HTTPException(status_code=400, detail="Text tìm kiếm phải có ít nhất 2 ký tự.")

    try:
        embedding = create_text_embedding(text)
    except Exception as exc:
        handle_embedding_runtime_error(exc)

    return response_payload(embedding)
