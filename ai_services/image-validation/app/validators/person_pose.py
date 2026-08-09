from dataclasses import dataclass

import numpy as np

from app.schemas import BodyRegion, ItemRole, OutfitMode
from app.settings import Settings


KEYPOINT_NAMES = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]

PERSON_BOX_CONTAINMENT_THRESHOLD = 0.8


@dataclass(frozen=True)
class NormalizedBox:
    x: float
    y: float
    width: float
    height: float

    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass(frozen=True)
class PersonPoseSummary:
    person_count: int
    main_person_score: float = 0.0
    main_person_box: NormalizedBox | None = None
    body_visibility: str = "unknown"
    pose_confidence: float | None = None
    visible_regions: frozenset[BodyRegion] = frozenset()


def _to_float(value: object, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _visible(keypoints: dict[str, float], names: list[str], threshold: float) -> bool:
    return any(keypoints.get(name, 0.0) >= threshold for name in names)


def _estimate_visible_regions(keypoints: dict[str, float], threshold: float) -> frozenset[BodyRegion]:
    if not keypoints:
        return frozenset()

    regions: set[BodyRegion] = set()
    if _visible(keypoints, ["left_shoulder", "right_shoulder"], threshold):
        regions.add("upper")
    if _visible(keypoints, ["left_hip", "right_hip"], threshold):
        regions.add("hips")
    if _visible(keypoints, ["left_knee", "right_knee", "left_ankle", "right_ankle"], threshold):
        regions.add("legs")
    if _visible(keypoints, ["left_ankle", "right_ankle"], threshold):
        regions.add("feet")
    return frozenset(regions)


def _required_regions_for_request(
    outfit_mode: OutfitMode | None,
    item_roles: list[ItemRole] | None,
) -> set[BodyRegion]:
    roles = set(item_roles or [])
    required_regions = set()
    if roles.intersection({"top", "outerwear", "accessory"}):
        required_regions.add("upper")
    if "bottom" in roles:
        required_regions.update({"hips", "legs"})
    if "dress" in roles:
        required_regions.update({"upper", "hips", "legs"})
    if "shoes" in roles:
        required_regions.update({"legs", "feet"})
    if not required_regions:
        if outfit_mode in {"top_bottom", "full_set"}:
            required_regions.update({"upper", "hips", "legs"})
        else:
            required_regions.update({"upper", "hips"})
    return required_regions


def _estimate_body_visibility(
    keypoints: dict[str, float],
    outfit_mode: OutfitMode | None,
    item_roles: list[ItemRole] | None,
    threshold: float,
) -> str:
    if not keypoints:
        return "unknown"

    visible_regions = _estimate_visible_regions(keypoints, threshold)
    required_regions = _required_regions_for_request(outfit_mode, item_roles)
    return "good" if required_regions.issubset(visible_regions) else "partial"


def _normalize_box(box_xyxy: np.ndarray, image_width: int, image_height: int) -> NormalizedBox:
    x1, y1, x2, y2 = [_to_float(value) for value in box_xyxy]
    x1 = max(0.0, min(x1, float(image_width)))
    x2 = max(0.0, min(x2, float(image_width)))
    y1 = max(0.0, min(y1, float(image_height)))
    y2 = max(0.0, min(y2, float(image_height)))

    return NormalizedBox(
        x=x1 / image_width if image_width else 0.0,
        y=y1 / image_height if image_height else 0.0,
        width=max(0.0, x2 - x1) / image_width if image_width else 0.0,
        height=max(0.0, y2 - y1) / image_height if image_height else 0.0,
    )


def _intersection_over_smaller_area(left: np.ndarray, right: np.ndarray) -> float:
    intersection_width = max(0.0, min(left[2], right[2]) - max(left[0], right[0]))
    intersection_height = max(0.0, min(left[3], right[3]) - max(left[1], right[1]))
    intersection = intersection_width * intersection_height
    left_area = max(0.0, left[2] - left[0]) * max(0.0, left[3] - left[1])
    right_area = max(0.0, right[2] - right[0]) * max(0.0, right[3] - right[1])
    smaller_area = min(left_area, right_area)
    return intersection / smaller_area if smaller_area > 0 else 0.0


def _count_distinct_person_boxes(boxes_xyxy: np.ndarray) -> int:
    """Collapse nested partial/full-body detections before counting people."""
    box_count = len(boxes_xyxy)
    parents = list(range(box_count))

    def find(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left_index: int, right_index: int) -> None:
        left_root = find(left_index)
        right_root = find(right_index)
        if left_root != right_root:
            parents[right_root] = left_root

    for left_index in range(box_count):
        for right_index in range(left_index + 1, box_count):
            containment = _intersection_over_smaller_area(
                boxes_xyxy[left_index],
                boxes_xyxy[right_index],
            )
            if containment >= PERSON_BOX_CONTAINMENT_THRESHOLD:
                union(left_index, right_index)

    return len({find(index) for index in range(box_count)})


class YoloPoseDetector:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return self._model

        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("ultralytics is not installed") from exc

        self._model = YOLO(self.settings.yolo_pose_model)
        return self._model

    def detect(
        self,
        image: np.ndarray,
        outfit_mode: OutfitMode | None,
        item_roles: list[ItemRole] | None = None,
    ) -> PersonPoseSummary:
        model = self._load_model()
        results = model.predict(
            source=image,
            conf=self.settings.person_confidence_threshold,
            imgsz=self.settings.yolo_image_size,
            verbose=False,
        )
        if not results:
            return PersonPoseSummary(person_count=0)

        result = results[0]
        boxes = getattr(result, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return PersonPoseSummary(person_count=0)

        confidences = boxes.conf.cpu().numpy()
        xyxy = boxes.xyxy.cpu().numpy()
        valid_indices = [index for index, score in enumerate(confidences) if score >= self.settings.person_confidence_threshold]
        if not valid_indices:
            return PersonPoseSummary(person_count=0)

        person_count = _count_distinct_person_boxes(xyxy[valid_indices])
        main_index = max(valid_indices, key=lambda index: confidences[index])
        image_height, image_width = image.shape[:2]
        main_box = _normalize_box(xyxy[main_index], image_width, image_height)

        keypoint_scores: dict[str, float] = {}
        keypoints = getattr(result, "keypoints", None)
        keypoint_conf = getattr(keypoints, "conf", None)
        if keypoint_conf is not None:
            keypoint_array = keypoint_conf.cpu().numpy()
            if main_index < len(keypoint_array):
                keypoint_scores = {
                    name: _to_float(keypoint_array[main_index][index])
                    for index, name in enumerate(KEYPOINT_NAMES)
                    if index < len(keypoint_array[main_index])
                }

        visible_scores = [
            value
            for value in keypoint_scores.values()
            if value >= self.settings.keypoint_confidence_threshold
        ]
        pose_confidence = float(np.mean(visible_scores)) if visible_scores else 0.0

        visible_regions = _estimate_visible_regions(
            keypoint_scores,
            self.settings.keypoint_confidence_threshold,
        )

        return PersonPoseSummary(
            person_count=person_count,
            main_person_score=_to_float(confidences[main_index]),
            main_person_box=main_box,
            body_visibility=_estimate_body_visibility(
                keypoint_scores,
                outfit_mode,
                item_roles,
                self.settings.keypoint_confidence_threshold,
            ),
            pose_confidence=pose_confidence,
            visible_regions=visible_regions,
        )
