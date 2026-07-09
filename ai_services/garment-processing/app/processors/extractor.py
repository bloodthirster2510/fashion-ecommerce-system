from dataclasses import dataclass
from typing import Literal

import numpy as np
from PIL import Image, ImageChops, ImageFilter

from app.settings import Settings


GarmentRole = Literal["top", "bottom", "dress", "shoes", "accessory", "outerwear"]


@dataclass(frozen=True)
class ExtractionResult:
    image: Image.Image
    role: GarmentRole
    method: str
    confidence: float
    bbox: tuple[int, int, int, int] | None


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


def _mask_bbox(mask: Image.Image) -> tuple[int, int, int, int] | None:
    return mask.getbbox()


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
) -> tuple[int, int, int, int]:
    left, top, right, bottom = foreground_box
    width = right - left
    height = bottom - top

    if role in {"top", "outerwear"}:
        role_box = (left, top, right, top + int(height * 0.58))
    elif role == "bottom":
        role_box = (left, top + int(height * 0.38), right, bottom)
    elif role == "shoes":
        # Shoe catalog images are usually already just the product, so keep the
        # whole foreground instead of trimming to a lower body band.
        role_box = foreground_box
    else:
        role_box = foreground_box

    return _pad_box(role_box, image_size, settings.crop_padding_ratio)


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


def extract_garment(
    image: Image.Image,
    role: GarmentRole,
    settings: Settings,
    max_long_edge: int | None = None,
) -> ExtractionResult:
    source = image.convert("RGBA")
    mask = _foreground_mask(source, settings)
    foreground_box = _mask_bbox(mask)
    if foreground_box is None:
        empty = Image.new("RGBA", (1, 1), (255, 255, 255, 0))
        return ExtractionResult(empty, role, "heuristic_empty", 0.0, None)

    role_box = _role_box(foreground_box, role, source.size, settings)
    cropped_image = source.crop(role_box)
    cropped_mask = mask.crop(role_box)
    extracted = _trim_transparent(_apply_mask(cropped_image, cropped_mask))
    extracted = _limit_long_edge(extracted, max_long_edge or settings.max_extracted_long_edge)

    return ExtractionResult(
        image=extracted,
        role=role,
        method="heuristic_foreground_role_crop",
        confidence=_confidence(mask, role_box),
        bbox=role_box,
    )
