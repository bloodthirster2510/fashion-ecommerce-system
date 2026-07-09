from dataclasses import dataclass
import os


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


@dataclass(frozen=True)
class Settings:
    max_image_bytes: int = _read_int("GARMENT_PROCESSING_MAX_BYTES", 10 * 1024 * 1024)
    background_threshold: float = _read_float("GARMENT_BACKGROUND_THRESHOLD", 34.0)
    near_white_threshold: int = _read_int("GARMENT_NEAR_WHITE_THRESHOLD", 244)
    crop_padding_ratio: float = _read_float("GARMENT_CROP_PADDING_RATIO", 0.04)
    max_extracted_long_edge: int = _read_int("GARMENT_MAX_EXTRACTED_LONG_EDGE", 640)
    default_canvas_width: int = _read_int("GARMENT_COLLAGE_WIDTH", 768)
    default_canvas_height: int = _read_int("GARMENT_COLLAGE_HEIGHT", 768)


def load_settings() -> Settings:
    return Settings()
