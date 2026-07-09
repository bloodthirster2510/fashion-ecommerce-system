from dataclasses import dataclass
import base64
import binascii

import cv2
import numpy as np

from app.schemas import Quality
from app.settings import Settings


@dataclass(frozen=True)
class QualityAssessment:
    quality: Quality
    blur_score: float
    brightness_score: float


def decode_image_base64(image_base64: str, max_bytes: int) -> np.ndarray:
    payload = image_base64.split(",", 1)[1] if "," in image_base64[:80] else image_base64
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("imageBase64 is not valid base64") from exc

    if len(raw) > max_bytes:
        raise ValueError("image is too large")

    image_array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("image cannot be decoded")
    return image


def _resolution_level(width: int, height: int, settings: Settings) -> str:
    return "ok" if width >= settings.min_width and height >= settings.min_height else "fail"


def _brightness_level(mean_brightness: float, settings: Settings) -> str:
    if mean_brightness < settings.brightness_min:
        return "fail"
    if mean_brightness > settings.brightness_max:
        return "warn"
    return "ok"


def _blur_level(laplacian_variance: float, settings: Settings) -> str:
    if laplacian_variance < settings.blur_threshold:
        return "fail"
    if laplacian_variance < settings.blur_threshold * 1.5:
        return "warn"
    return "ok"


def assess_quality(
    image: np.ndarray,
    reported_width: int,
    reported_height: int,
    settings: Settings,
) -> QualityAssessment:
    actual_height, actual_width = image.shape[:2]
    width = reported_width or actual_width
    height = reported_height or actual_height
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness_score = float(gray.mean())

    return QualityAssessment(
        quality=Quality(
            blur=_blur_level(blur_score, settings),
            brightness=_brightness_level(brightness_score, settings),
            resolution=_resolution_level(width, height, settings),
        ),
        blur_score=blur_score,
        brightness_score=brightness_score,
    )
