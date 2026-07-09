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
    provider_name: str = "custom_model"
    yolo_pose_model: str = os.getenv("IMAGE_VALIDATION_YOLO_POSE_MODEL", "yolo11n-pose.pt")
    yolo_image_size: int = _read_int("IMAGE_VALIDATION_YOLO_IMAGE_SIZE", 960)
    person_confidence_threshold: float = _read_float("IMAGE_VALIDATION_PERSON_CONFIDENCE_THRESHOLD", 0.35)
    person_score_threshold: float = _read_float("IMAGE_VALIDATION_PERSON_SCORE_THRESHOLD", 0.5)
    keypoint_confidence_threshold: float = _read_float("IMAGE_VALIDATION_KEYPOINT_CONFIDENCE_THRESHOLD", 0.25)
    pose_confidence_threshold: float = _read_float("IMAGE_VALIDATION_POSE_CONFIDENCE_THRESHOLD", 0.3)
    min_width: int = _read_int("IMAGE_VALIDATION_MIN_WIDTH", 400)
    min_height: int = _read_int("IMAGE_VALIDATION_MIN_HEIGHT", 400)
    blur_threshold: float = _read_float("IMAGE_VALIDATION_BLUR_THRESHOLD", 100.0)
    brightness_min: float = _read_float("IMAGE_VALIDATION_BRIGHTNESS_MIN", 40.0)
    brightness_max: float = _read_float("IMAGE_VALIDATION_BRIGHTNESS_MAX", 220.0)
    single_min_box_area_ratio: float = _read_float("IMAGE_VALIDATION_SINGLE_MIN_BOX_AREA_RATIO", 0.08)
    single_min_box_height_ratio: float = _read_float("IMAGE_VALIDATION_SINGLE_MIN_BOX_HEIGHT_RATIO", 0.35)
    outfit_min_box_area_ratio: float = _read_float("IMAGE_VALIDATION_OUTFIT_MIN_BOX_AREA_RATIO", 0.12)
    outfit_min_box_height_ratio: float = _read_float("IMAGE_VALIDATION_OUTFIT_MIN_BOX_HEIGHT_RATIO", 0.45)
    max_image_bytes: int = _read_int("IMAGE_VALIDATION_MAX_BYTES", 10 * 1024 * 1024)


def load_settings() -> Settings:
    return Settings()
