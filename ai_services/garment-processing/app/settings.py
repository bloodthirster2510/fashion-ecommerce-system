from dataclasses import dataclass
import os
from pathlib import Path


def _read_int(name: str, fallback: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return fallback
    try:
        return int(raw)
    except ValueError:
        return fallback


def _read_float(name: str, fallback: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return fallback
    try:
        return float(raw)
    except ValueError:
        return fallback


def _read_bool(name: str, fallback: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return fallback
    return raw.strip().lower() in {"1", "true", "yes", "on"}


_SERVICE_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    provider_name: str = os.getenv("GARMENT_PROCESSING_PROVIDER", "hybrid").strip().lower()
    max_image_bytes: int = _read_int("GARMENT_PROCESSING_MAX_BYTES", 10 * 1024 * 1024)
    background_threshold: float = _read_float("GARMENT_BACKGROUND_THRESHOLD", 34.0)
    near_white_threshold: int = _read_int("GARMENT_NEAR_WHITE_THRESHOLD", 244)
    crop_padding_ratio: float = _read_float("GARMENT_CROP_PADDING_RATIO", 0.04)
    max_extracted_long_edge: int = _read_int("GARMENT_MAX_EXTRACTED_LONG_EDGE", 640)
    min_source_short_edge: int = _read_int("GARMENT_MIN_SOURCE_SHORT_EDGE", 160)
    min_bbox_short_edge: int = _read_int("GARMENT_MIN_BBOX_SHORT_EDGE", 32)
    min_bbox_area_ratio: float = _read_float("GARMENT_MIN_BBOX_AREA_RATIO", 0.015)
    min_confidence: float = _read_float("GARMENT_MIN_CONFIDENCE", 0.2)
    ambiguous_mask_ratio: float = _read_float("GARMENT_AMBIGUOUS_MASK_RATIO", 0.72)
    role_crop_min_aspect_ratio: float = _read_float("GARMENT_ROLE_CROP_MIN_ASPECT_RATIO", 1.85)
    role_crop_color_delta: float = _read_float("GARMENT_ROLE_CROP_COLOR_DELTA", 42.0)
    simple_background_border_ratio: float = _read_float(
        "GARMENT_SIMPLE_BACKGROUND_BORDER_RATIO",
        0.88,
    )
    simple_background_min_margin_ratio: float = _read_float(
        "GARMENT_SIMPLE_BACKGROUND_MIN_MARGIN_RATIO",
        0.012,
    )
    detector_model_id: str = os.getenv(
        "GARMENT_DETECTOR_MODEL_ID",
        "IDEA-Research/grounding-dino-tiny",
    )
    segmenter_model_id: str = os.getenv(
        "GARMENT_SEGMENTER_MODEL_ID",
        "facebook/sam2.1-hiera-tiny",
    )
    model_cache_dir: str = os.getenv(
        "GARMENT_MODEL_CACHE_DIR",
        str(_SERVICE_ROOT / "models" / "huggingface"),
    )
    model_local_files_only: bool = _read_bool("GARMENT_MODEL_LOCAL_FILES_ONLY", True)
    model_device: str = os.getenv("GARMENT_MODEL_DEVICE", "auto").strip().lower()
    detector_box_threshold: float = _read_float("GARMENT_DETECTOR_BOX_THRESHOLD", 0.2)
    detector_text_threshold: float = _read_float("GARMENT_DETECTOR_TEXT_THRESHOLD", 0.2)
    segmenter_mask_threshold: float = _read_float("GARMENT_SEGMENTER_MASK_THRESHOLD", 0.0)
    min_model_confidence: float = _read_float("GARMENT_MIN_MODEL_CONFIDENCE", 0.3)
    min_model_mask_area_ratio: float = _read_float("GARMENT_MIN_MODEL_MASK_AREA_RATIO", 0.01)
    max_model_mask_area_ratio: float = _read_float("GARMENT_MAX_MODEL_MASK_AREA_RATIO", 0.9)
    model_warmup_on_start: bool = _read_bool("GARMENT_MODEL_WARMUP_ON_START", False)
    default_canvas_width: int = _read_int("GARMENT_COLLAGE_WIDTH", 768)
    default_canvas_height: int = _read_int("GARMENT_COLLAGE_HEIGHT", 768)


def load_settings() -> Settings:
    return Settings()
