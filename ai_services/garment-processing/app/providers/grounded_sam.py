from dataclasses import dataclass
import threading
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.processors.extractor import (
    ExtractionIssue,
    ExtractionResult,
    GarmentRole,
    empty_extraction_result,
    extraction_from_box,
)
from app.settings import Settings


ROLE_PROMPTS: dict[GarmentRole, list[str]] = {
    "top": [
        "shirt",
        "t-shirt",
        "polo shirt",
        "blouse",
        "sweater",
        "sweatshirt",
        "tank top",
        "upper body garment",
    ],
    "outerwear": [
        "jacket",
        "coat",
        "blazer",
        "cardigan",
        "hoodie",
        "outerwear",
    ],
    "bottom": [
        "pants",
        "trousers",
        "jeans",
        "shorts",
        "skirt",
        "lower body garment",
    ],
    "dress": [
        "dress",
        "gown",
        "jumpsuit",
        "one piece garment",
    ],
    "shoes": [
        "shoe",
        "sneaker",
        "sandal",
        "boot",
        "loafer",
        "high heel",
        "footwear",
    ],
    "accessory": [
        "fashion accessory",
        "handbag",
        "hat",
        "belt",
        "scarf",
    ],
}


@dataclass(frozen=True)
class Detection:
    box: tuple[float, float, float, float]
    score: float
    label: str


def _box_iou(
    left: tuple[float, float, float, float],
    right: tuple[float, float, float, float],
) -> float:
    intersection_left = max(left[0], right[0])
    intersection_top = max(left[1], right[1])
    intersection_right = min(left[2], right[2])
    intersection_bottom = min(left[3], right[3])
    intersection = max(0.0, intersection_right - intersection_left) * max(
        0.0,
        intersection_bottom - intersection_top,
    )
    left_area = max(0.0, left[2] - left[0]) * max(0.0, left[3] - left[1])
    right_area = max(0.0, right[2] - right[0]) * max(0.0, right[3] - right[1])
    union = left_area + right_area - intersection
    return intersection / union if union > 0 else 0.0


def select_detections(
    detections: list[Detection],
    role: GarmentRole,
    image_size: tuple[int, int] | None = None,
    iou_threshold: float = 0.55,
) -> list[Detection]:
    selected: list[Detection] = []
    limit = 2 if role == "shoes" else 1
    for candidate in sorted(detections, key=lambda item: item.score, reverse=True):
        if image_size is not None:
            _width, height = image_size
            center_y_ratio = ((candidate.box[1] + candidate.box[3]) / 2) / max(1, height)
            if role == "top" and not 0.14 <= center_y_ratio <= 0.66:
                continue
            if role == "outerwear" and not 0.12 <= center_y_ratio <= 0.75:
                continue
            if role == "bottom" and center_y_ratio < 0.3:
                continue
        if any(_box_iou(candidate.box, item.box) >= iou_threshold for item in selected):
            continue
        selected.append(candidate)
        if len(selected) >= limit:
            break
    return selected


def keep_largest_components(mask: np.ndarray, limit: int) -> np.ndarray:
    binary = mask.astype(np.uint8)
    component_count, labels, stats, _centroids = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8,
    )
    if component_count <= 1:
        return mask.astype(bool)

    component_ids = sorted(
        range(1, component_count),
        key=lambda component_id: int(stats[component_id, cv2.CC_STAT_AREA]),
        reverse=True,
    )[:limit]
    return np.isin(labels, component_ids)


class GroundedSamProvider:
    name = "grounded_sam"

    def __init__(self, settings: Settings):
        self.settings = settings
        self._load_lock = threading.Lock()
        self._state = "not_loaded"
        self._load_error: str | None = None
        self._torch: Any = None
        self._device: Any = None
        self._detector_processor: Any = None
        self._detector_model: Any = None
        self._segmenter_processor: Any = None
        self._segmenter_model: Any = None

    def status(self) -> dict[str, object]:
        return {
            "name": self.name,
            "state": self._state,
            "device": str(self._device) if self._device is not None else None,
            "detectorModel": self.settings.detector_model_id,
            "segmenterModel": self.settings.segmenter_model_id,
            "outputMode": "box_crop",
            "localFilesOnly": self.settings.model_local_files_only,
            "error": self._load_error,
        }

    def warmup(self) -> None:
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        if self._state == "ready":
            return
        if self._state == "error":
            raise RuntimeError(self._load_error or "Grounded SAM could not be loaded")

        with self._load_lock:
            if self._state == "ready":
                return
            try:
                import torch
                from transformers import (
                    AutoModelForZeroShotObjectDetection,
                    AutoProcessor,
                    Sam2Model,
                    Sam2Processor,
                )

                if self.settings.model_device == "auto":
                    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                else:
                    device = torch.device(self.settings.model_device)

                common = {
                    "cache_dir": self.settings.model_cache_dir,
                    "local_files_only": self.settings.model_local_files_only,
                }
                self._detector_processor = AutoProcessor.from_pretrained(
                    self.settings.detector_model_id,
                    **common,
                )
                self._detector_model = AutoModelForZeroShotObjectDetection.from_pretrained(
                    self.settings.detector_model_id,
                    **common,
                ).to(device)
                self._segmenter_processor = Sam2Processor.from_pretrained(
                    self.settings.segmenter_model_id,
                    **common,
                )
                self._segmenter_model = Sam2Model.from_pretrained(
                    self.settings.segmenter_model_id,
                    **common,
                ).to(device)
                self._detector_model.eval()
                self._segmenter_model.eval()
                self._torch = torch
                self._device = device
                self._state = "ready"
                self._load_error = None
            except Exception as exc:
                self._state = "error"
                self._load_error = f"{type(exc).__name__}: {exc}"
                raise RuntimeError(self._load_error) from exc

    def _detect(self, image: Image.Image, role: GarmentRole) -> list[Detection]:
        prompts = ROLE_PROMPTS[role]
        inputs = self._detector_processor(
            images=image,
            text=[prompts],
            return_tensors="pt",
        ).to(self._device)
        with self._torch.inference_mode():
            outputs = self._detector_model(**inputs)

        result = self._detector_processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=self.settings.detector_box_threshold,
            text_threshold=self.settings.detector_text_threshold,
            target_sizes=[image.size[::-1]],
            text_labels=[prompts],
        )[0]
        labels = result["text_labels"] if "text_labels" in result else result["labels"]
        detections = [
            Detection(
                box=tuple(float(value) for value in box.tolist()),
                score=float(score.item()),
                label=str(label),
            )
            for box, score, label in zip(result["boxes"], result["scores"], labels)
        ]
        return select_detections(detections, role, image.size)

    def _segment(
        self,
        image: Image.Image,
        detections: list[Detection],
        role: GarmentRole,
    ) -> tuple[Image.Image, float]:
        boxes = [[list(item.box) for item in detections]]
        inputs = self._segmenter_processor(
            images=image,
            input_boxes=boxes,
            return_tensors="pt",
        ).to(self._device)
        with self._torch.inference_mode():
            outputs = self._segmenter_model(**inputs, multimask_output=True)

        masks = self._segmenter_processor.post_process_masks(
            outputs.pred_masks.detach().cpu(),
            inputs["original_sizes"].detach().cpu(),
            mask_threshold=self.settings.segmenter_mask_threshold,
        )[0]
        iou_scores = outputs.iou_scores.detach().cpu()[0]
        if masks.ndim == 3:
            masks = masks.unsqueeze(0)
        if iou_scores.ndim == 1:
            iou_scores = iou_scores.unsqueeze(0)

        combined = np.zeros((image.height, image.width), dtype=bool)
        selected_scores: list[float] = []
        for object_index in range(masks.shape[0]):
            best_mask_index = int(self._torch.argmax(iou_scores[object_index]).item())
            combined |= masks[object_index, best_mask_index].numpy().astype(bool)
            selected_scores.append(float(iou_scores[object_index, best_mask_index].item()))

        combined = keep_largest_components(combined, 2 if role == "shoes" else 1)
        return Image.fromarray(combined.astype(np.uint8) * 255, mode="L"), (
            sum(selected_scores) / len(selected_scores)
        )

    def extract(
        self,
        image: Image.Image,
        role: GarmentRole,
        max_long_edge: int | None = None,
    ) -> ExtractionResult:
        source = image.convert("RGB")
        try:
            self._ensure_loaded()
        except RuntimeError as exc:
            return empty_extraction_result(
                role,
                "grounded_sam_unavailable",
                ExtractionIssue(
                    code="model_unavailable",
                    severity="error",
                    message=f"Grounded SAM is unavailable: {exc}",
                ),
            )

        try:
            detections = self._detect(source, role)
            if not detections:
                return empty_extraction_result(
                    role,
                    "grounded_sam_not_detected",
                    ExtractionIssue(
                        code="garment_not_detected",
                        severity="error",
                        message=f"No {role} garment could be detected.",
                    ),
                )

            mask, mask_score = self._segment(source, detections, role)
        except Exception as exc:
            return empty_extraction_result(
                role,
                "grounded_sam_failed",
                ExtractionIssue(
                    code="model_inference_failed",
                    severity="error",
                    message=f"Grounded SAM inference failed: {type(exc).__name__}: {exc}",
                ),
            )

        detection_score = sum(item.score for item in detections) / len(detections)
        confidence = detection_score * 0.65 + mask_score * 0.35
        mask_array = np.array(mask) > 0
        area_ratio = float(mask_array.mean())
        bbox = mask.getbbox()
        quality_issues: list[ExtractionIssue] = []

        if confidence < self.settings.min_model_confidence:
            quality_issues.append(ExtractionIssue(
                code="model_low_confidence",
                severity="error",
                message="Garment detection and segmentation confidence is too low.",
            ))
        if (
            area_ratio < self.settings.min_model_mask_area_ratio
            or area_ratio > self.settings.max_model_mask_area_ratio
        ):
            quality_issues.append(ExtractionIssue(
                code="model_mask_area_invalid",
                severity="error",
                message="Segmented garment area is outside the accepted range.",
            ))
        if bbox and role in {"top", "outerwear", "bottom", "dress"}:
            left, top, right, bottom = bbox
            if left <= 1 or top <= 1 or right >= image.width - 1 or bottom >= image.height - 1:
                quality_issues.append(ExtractionIssue(
                    code="truncated_garment",
                    severity="error",
                    message="The garment touches the image boundary and may be cropped.",
                ))

        if bbox is None:
            return empty_extraction_result(
                role,
                "grounded_sam_empty_mask",
                ExtractionIssue(
                    code="empty_mask",
                    severity="error",
                    message="No garment region could be derived from the segmentation mask.",
                ),
            )

        return extraction_from_box(
            image=image,
            box=bbox,
            role=role,
            settings=self.settings,
            method="grounded_sam_box_crop",
            confidence=confidence,
            max_long_edge=max_long_edge,
            extra_issues=quality_issues,
        )
