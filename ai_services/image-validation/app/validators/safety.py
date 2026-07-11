import cv2
import numpy as np

from app.settings import Settings
from app.validators.person_pose import NormalizedBox, PersonPoseSummary


SAFETY_FLAG_EXPLICIT = "explicit"


def _crop_from_box(image: np.ndarray, box: NormalizedBox) -> np.ndarray:
    height, width = image.shape[:2]
    x1 = int(max(0.0, min(1.0, box.x)) * width)
    y1 = int(max(0.0, min(1.0, box.y)) * height)
    x2 = int(max(0.0, min(1.0, box.x + box.width)) * width)
    y2 = int(max(0.0, min(1.0, box.y + box.height)) * height)

    if x2 <= x1 or y2 <= y1:
        return image[0:0, 0:0]
    return image[y1:y2, x1:x2]


def _torso_crop(person_crop: np.ndarray) -> np.ndarray:
    height, width = person_crop.shape[:2]
    if height <= 0 or width <= 0:
        return person_crop

    y1 = int(height * 0.18)
    y2 = int(height * 0.72)
    x1 = int(width * 0.16)
    x2 = int(width * 0.84)
    return person_crop[y1:y2, x1:x2]


def _skin_mask(image: np.ndarray) -> np.ndarray:
    if image.size == 0:
        return np.zeros(image.shape[:2], dtype=np.uint8)

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)

    # Conservative union of two common skin-color spaces. This is not a full
    # NSFW classifier; it is a fallback guard for very high exposed-skin cases.
    hsv_mask = cv2.inRange(hsv, np.array([0, 25, 45], dtype=np.uint8), np.array([25, 210, 255], dtype=np.uint8))
    ycrcb_mask = cv2.inRange(
        ycrcb,
        np.array([35, 133, 77], dtype=np.uint8),
        np.array([255, 180, 135], dtype=np.uint8),
    )
    mask = cv2.bitwise_and(hsv_mask, ycrcb_mask)

    kernel = np.ones((5, 5), dtype=np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)


def _mask_ratio(mask: np.ndarray) -> float:
    if mask.size == 0:
        return 0.0
    return float(np.count_nonzero(mask)) / float(mask.size)


def assess_safety(image: np.ndarray, pose: PersonPoseSummary | None, settings: Settings) -> list[str]:
    if not settings.safety_heuristic_enabled:
        return []

    if pose is None or pose.person_count != 1 or pose.main_person_box is None:
        return []

    if pose.main_person_box.area < settings.safety_min_person_crop_area_ratio:
        return []

    person_crop = _crop_from_box(image, pose.main_person_box)
    if person_crop.size == 0:
        return []

    full_skin_ratio = _mask_ratio(_skin_mask(person_crop))
    torso_skin_ratio = _mask_ratio(_skin_mask(_torso_crop(person_crop)))

    if (
        full_skin_ratio >= settings.safety_skin_ratio_threshold
        or torso_skin_ratio >= settings.safety_torso_skin_ratio_threshold
    ):
        return [SAFETY_FLAG_EXPLICIT]

    return []
