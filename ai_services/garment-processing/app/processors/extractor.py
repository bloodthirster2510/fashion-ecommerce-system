from dataclasses import dataclass
from typing import Literal

import numpy as np
from PIL import Image, ImageChops, ImageFilter

from app.settings import Settings


GarmentRole = Literal["top", "bottom", "dress", "shoes", "accessory", "outerwear"]
IssueSeverity = Literal["warning", "error"]


@dataclass(frozen=True)
class ExtractionIssue:
    code: str
    severity: IssueSeverity
    message: str


@dataclass(frozen=True)
class ExtractionResult:
    image: Image.Image
    role: GarmentRole
    method: str
    confidence: float
    bbox: tuple[int, int, int, int] | None
    issues: list[ExtractionIssue]

    @property
    def warnings(self) -> list[str]:
        return [issue.code for issue in self.issues if issue.severity == "warning"]

    @property
    def is_usable(self) -> bool:
        return not any(issue.severity == "error" for issue in self.issues)


def _estimate_background_rgb(rgb: np.ndarray) -> np.ndarray:
    top_left = rgb[: max(1, rgb.shape[0] // 12), : max(1, rgb.shape[1] // 12)]
    top_right = rgb[: max(1, rgb.shape[0] // 12), -max(1, rgb.shape[1] // 12) :]
    bottom_left = rgb[-max(1, rgb.shape[0] // 12) :, : max(1, rgb.shape[1] // 12)]
    bottom_right = rgb[-max(1, rgb.shape[0] // 12) :, -max(1, rgb.shape[1] // 12) :]
    corners = np.concatenate([
        top_left.reshape(-1, 3),
        top_right.reshape(-1, 3),
        bottom_left.reshape(-1, 3),
        bottom_right.reshape(-1, 3),
    ])
    return np.median(corners, axis=0)


def _foreground_mask(image: Image.Image, settings: Settings) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    alpha = rgba[:, :, 3]
    if alpha.min() < 250:
        mask = alpha > 12
    else:
        rgb = rgba[:, :, :3].astype(np.float32)
        background = _estimate_background_rgb(rgb)
        distance = np.linalg.norm(rgb - background, axis=2)
        near_white = np.all(rgb >= settings.near_white_threshold, axis=2)
        mask = (distance > settings.background_threshold) & ~near_white

    mask_image = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    # Smooth pinholes and tiny background specks without needing heavyweight morphology.
    return mask_image.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))


def has_transparency(image: Image.Image) -> bool:
    alpha = np.array(image.convert("RGBA"))[:, :, 3]
    return bool(alpha.min() < 250)


def is_simple_catalog_image(image: Image.Image, settings: Settings) -> bool:
    source = image.convert("RGBA")
    if has_transparency(source):
        return True

    mask = _foreground_mask(source, settings)
    bbox = mask.getbbox()
    if bbox is None:
        return True

    width, height = source.size
    left, top, right, bottom = bbox
    min_margin_x = width * settings.simple_background_min_margin_ratio
    min_margin_y = height * settings.simple_background_min_margin_ratio
    if (
        left < min_margin_x
        or top < min_margin_y
        or width - right < min_margin_x
        or height - bottom < min_margin_y
    ):
        return False

    alpha = np.array(mask) > 12
    border_width = max(2, int(min(width, height) * 0.04))
    border = np.concatenate([
        alpha[:border_width, :].reshape(-1),
        alpha[-border_width:, :].reshape(-1),
        alpha[:, :border_width].reshape(-1),
        alpha[:, -border_width:].reshape(-1),
    ])
    background_ratio = 1.0 - float(border.mean())
    return background_ratio >= settings.simple_background_border_ratio


def _mask_bbox(mask: Image.Image) -> tuple[int, int, int, int] | None:
    return mask.getbbox()


def _mask_ratio(mask: Image.Image) -> float:
    alpha = np.array(mask)
    if alpha.size == 0:
        return 0.0
    return float((alpha > 12).sum() / alpha.size)


def _pad_box(
    box: tuple[int, int, int, int],
    image_size: tuple[int, int],
    padding_ratio: float,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    pad_x = int(width * padding_ratio)
    pad_y = int(height * padding_ratio)
    image_width, image_height = image_size
    return (
        max(0, left - pad_x),
        max(0, top - pad_y),
        min(image_width, right + pad_x),
        min(image_height, bottom + pad_y),
    )


def _role_box(
    foreground_box: tuple[int, int, int, int],
    role: GarmentRole,
    image_size: tuple[int, int],
    settings: Settings,
    should_role_crop: bool,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = foreground_box
    height = bottom - top

    if should_role_crop and role in {"top", "outerwear"}:
        role_box = (left, top, right, top + int(height * 0.58))
    elif should_role_crop and role == "bottom":
        role_box = (left, top + int(height * 0.38), right, bottom)
    elif role == "shoes":
        # Shoe catalog images are usually already just the product, so keep the
        # whole foreground instead of trimming to a lower body band.
        role_box = foreground_box
    else:
        role_box = foreground_box

    return _pad_box(role_box, image_size, settings.crop_padding_ratio)


def _median_foreground_color(
    image: Image.Image,
    mask: Image.Image,
    box: tuple[int, int, int, int],
) -> np.ndarray | None:
    left, top, right, bottom = box
    if right <= left or bottom <= top:
        return None

    rgb = np.array(image.convert("RGB").crop(box), dtype=np.float32)
    alpha = np.array(mask.crop(box))
    foreground = rgb[alpha > 12]
    if foreground.size == 0:
        return None
    return np.median(foreground, axis=0)


def _should_role_crop(
    image: Image.Image,
    mask: Image.Image,
    foreground_box: tuple[int, int, int, int],
    role: GarmentRole,
    settings: Settings,
) -> bool:
    if role not in {"top", "outerwear", "bottom"}:
        return False

    left, top, right, bottom = foreground_box
    width = max(1, right - left)
    height = max(1, bottom - top)
    if height / width < settings.role_crop_min_aspect_ratio:
        return False

    split_y = top + int(height * 0.5)
    upper = _median_foreground_color(image, mask, (left, top, right, split_y))
    lower = _median_foreground_color(image, mask, (left, split_y, right, bottom))
    if upper is None or lower is None:
        return False

    color_delta = float(np.linalg.norm(upper - lower))
    return color_delta >= settings.role_crop_color_delta


def _trim_transparent(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    return image.crop(bbox) if bbox else image


def _limit_long_edge(image: Image.Image, max_long_edge: int) -> Image.Image:
    width, height = image.size
    long_edge = max(width, height)
    if long_edge <= max_long_edge:
        return image
    scale = max_long_edge / long_edge
    size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def _apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    result = image.copy()
    result.putalpha(ImageChops.multiply(result.getchannel("A"), mask))
    return result


def _confidence(mask: Image.Image, role_box: tuple[int, int, int, int]) -> float:
    cropped_mask = mask.crop(role_box)
    alpha = np.array(cropped_mask)
    if alpha.size == 0:
        return 0.0
    foreground_ratio = float((alpha > 12).sum() / alpha.size)
    return max(0.1, min(0.95, foreground_ratio * 2.4))


def _issues_for_result(
    source_size: tuple[int, int],
    mask_ratio: float,
    bbox: tuple[int, int, int, int] | None,
    confidence: float,
    settings: Settings,
) -> list[ExtractionIssue]:
    issues: list[ExtractionIssue] = []
    source_width, source_height = source_size
    source_area = max(1, source_width * source_height)

    if min(source_width, source_height) < settings.min_source_short_edge:
        issues.append(ExtractionIssue(
            code="tiny_image",
            severity="warning",
            message="Source image is small, extraction may lose garment details.",
        ))

    if bbox is None:
        issues.append(ExtractionIssue(
            code="empty_mask",
            severity="error",
            message="No garment foreground could be detected.",
        ))
        return issues

    left, top, right, bottom = bbox
    bbox_width = max(0, right - left)
    bbox_height = max(0, bottom - top)
    bbox_area_ratio = (bbox_width * bbox_height) / source_area
    if (
        bbox_width < settings.min_bbox_short_edge
        or bbox_height < settings.min_bbox_short_edge
        or bbox_area_ratio < settings.min_bbox_area_ratio
    ):
        issues.append(ExtractionIssue(
            code="small_bbox",
            severity="error",
            message="Detected garment area is too small to use reliably.",
        ))

    if confidence < settings.min_confidence:
        issues.append(ExtractionIssue(
            code="low_confidence",
            severity="warning",
            message="Garment extraction confidence is low.",
        ))

    if mask_ratio >= settings.ambiguous_mask_ratio:
        issues.append(ExtractionIssue(
            code="ambiguous_foreground",
            severity="warning",
            message="Foreground covers most of the image, background removal may be ambiguous.",
        ))

    return issues


def empty_extraction_result(
    role: GarmentRole,
    method: str,
    issue: ExtractionIssue,
) -> ExtractionResult:
    return ExtractionResult(
        image=Image.new("RGBA", (1, 1), (255, 255, 255, 0)),
        role=role,
        method=method,
        confidence=0.0,
        bbox=None,
        issues=[issue],
    )


def extraction_from_mask(
    image: Image.Image,
    mask: Image.Image,
    role: GarmentRole,
    settings: Settings,
    method: str,
    confidence: float,
    max_long_edge: int | None = None,
    extra_issues: list[ExtractionIssue] | None = None,
) -> ExtractionResult:
    source = image.convert("RGBA")
    normalized_mask = mask.convert("L")
    if normalized_mask.size != source.size:
        normalized_mask = normalized_mask.resize(source.size, Image.Resampling.NEAREST)

    foreground_ratio = _mask_ratio(normalized_mask)
    foreground_box = _mask_bbox(normalized_mask)
    if foreground_box is None:
        return empty_extraction_result(
            role,
            method,
            ExtractionIssue(
                code="empty_mask",
                severity="error",
                message="No garment foreground could be detected.",
            ),
        )

    crop_box = _pad_box(foreground_box, source.size, settings.crop_padding_ratio)
    cropped_image = source.crop(crop_box)
    cropped_mask = normalized_mask.crop(crop_box)
    extracted = _trim_transparent(_apply_mask(cropped_image, cropped_mask))
    extracted = _limit_long_edge(extracted, max_long_edge or settings.max_extracted_long_edge)
    issues = _issues_for_result(
        source.size,
        foreground_ratio,
        crop_box,
        confidence,
        settings,
    )
    if extra_issues:
        issues.extend(extra_issues)

    return ExtractionResult(
        image=extracted,
        role=role,
        method=method,
        confidence=max(0.0, min(1.0, confidence)),
        bbox=crop_box,
        issues=issues,
    )


def extraction_from_box(
    image: Image.Image,
    box: tuple[int, int, int, int],
    role: GarmentRole,
    settings: Settings,
    method: str,
    confidence: float,
    max_long_edge: int | None = None,
    extra_issues: list[ExtractionIssue] | None = None,
) -> ExtractionResult:
    source = image.convert("RGBA")
    left, top, right, bottom = box
    normalized_box = (
        max(0, min(source.width, left)),
        max(0, min(source.height, top)),
        max(0, min(source.width, right)),
        max(0, min(source.height, bottom)),
    )
    if normalized_box[2] <= normalized_box[0] or normalized_box[3] <= normalized_box[1]:
        return empty_extraction_result(
            role,
            method,
            ExtractionIssue(
                code="empty_box",
                severity="error",
                message="No valid garment crop region could be detected.",
            ),
        )

    crop_box = _pad_box(normalized_box, source.size, settings.crop_padding_ratio)
    extracted = _limit_long_edge(
        source.crop(crop_box),
        max_long_edge or settings.max_extracted_long_edge,
    )
    issues = _issues_for_result(
        source.size,
        0.0,
        crop_box,
        confidence,
        settings,
    )
    if extra_issues:
        issues.extend(extra_issues)

    return ExtractionResult(
        image=extracted,
        role=role,
        method=method,
        confidence=max(0.0, min(1.0, confidence)),
        bbox=crop_box,
        issues=issues,
    )


def extract_garment(
    image: Image.Image,
    role: GarmentRole,
    settings: Settings,
    max_long_edge: int | None = None,
) -> ExtractionResult:
    source = image.convert("RGBA")
    mask = _foreground_mask(source, settings)
    foreground_ratio = _mask_ratio(mask)
    foreground_box = _mask_bbox(mask)
    if foreground_box is None:
        issues = _issues_for_result(source.size, foreground_ratio, None, 0.0, settings)
        return ExtractionResult(
            Image.new("RGBA", (1, 1), (255, 255, 255, 0)),
            role,
            "heuristic_empty",
            0.0,
            None,
            issues,
        )

    should_role_crop = _should_role_crop(source, mask, foreground_box, role, settings)
    role_box = _role_box(foreground_box, role, source.size, settings, should_role_crop)
    cropped_image = source.crop(role_box)
    cropped_mask = mask.crop(role_box)
    extracted = _trim_transparent(_apply_mask(cropped_image, cropped_mask))
    extracted = _limit_long_edge(extracted, max_long_edge or settings.max_extracted_long_edge)
    confidence = _confidence(mask, role_box)
    issues = _issues_for_result(source.size, foreground_ratio, role_box, confidence, settings)

    return ExtractionResult(
        image=extracted,
        role=role,
        method="heuristic_foreground_role_crop" if should_role_crop else "heuristic_foreground",
        confidence=confidence,
        bbox=role_box,
        issues=issues,
    )
