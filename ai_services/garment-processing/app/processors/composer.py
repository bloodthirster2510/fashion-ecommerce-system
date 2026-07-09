from dataclasses import dataclass
from typing import Literal

from PIL import Image

from app.processors.image_io import parse_hex_color


GarmentRole = Literal["top", "bottom", "dress", "shoes", "accessory", "outerwear"]
CollageLayout = Literal["auto", "single", "top_bottom", "full_set", "horizontal"]


@dataclass(frozen=True)
class CollageItem:
    image: Image.Image
    role: GarmentRole
    label: str | None = None


@dataclass(frozen=True)
class Placement:
    x: int
    y: int
    width: int
    height: int


@dataclass(frozen=True)
class CollageResult:
    image: Image.Image
    layout: CollageLayout
    placements: list[Placement]


def _resolve_layout(items: list[CollageItem], layout: CollageLayout) -> CollageLayout:
    if layout != "auto":
        return layout
    roles = {item.role for item in items}
    if len(items) == 1:
        return "single"
    if roles.issubset({"top", "outerwear", "bottom"}):
        return "top_bottom"
    if len(items) >= 3 or "shoes" in roles:
        return "full_set"
    return "horizontal"


def _slot_boxes(count: int, layout: CollageLayout, width: int, height: int) -> list[tuple[int, int, int, int]]:
    margin = int(min(width, height) * 0.08)
    gap = int(min(width, height) * 0.04)
    if layout == "single":
        return [(margin, margin, width - margin, height - margin)]
    if layout == "top_bottom":
        slot_width = (width - margin * 2 - gap) // 2
        return [
            (margin, margin, margin + slot_width, height - margin),
            (margin + slot_width + gap, margin, width - margin, height - margin),
        ][:count]
    if layout == "full_set":
        top_height = int((height - margin * 2 - gap) * 0.66)
        slot_width = (width - margin * 2 - gap) // 2
        boxes = [
            (margin, margin, margin + slot_width, margin + top_height),
            (margin + slot_width + gap, margin, width - margin, margin + top_height),
            (margin, margin + top_height + gap, width - margin, height - margin),
        ]
        if count > 3:
            boxes.extend(_slot_boxes(count - 3, "horizontal", width, height)[0 : count - 3])
        return boxes[:count]

    slot_width = (width - margin * 2 - gap * (count - 1)) // count
    return [
        (
            margin + index * (slot_width + gap),
            margin,
            margin + index * (slot_width + gap) + slot_width,
            height - margin,
        )
        for index in range(count)
    ]


def _fit_image(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    max_width = max(1, right - left)
    max_height = max(1, bottom - top)
    fitted = image.convert("RGBA").copy()
    fitted.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return fitted


def _sort_items(items: list[CollageItem]) -> list[CollageItem]:
    order = {"top": 0, "outerwear": 1, "dress": 2, "bottom": 3, "shoes": 4, "accessory": 5}
    return sorted(items, key=lambda item: order.get(item.role, 99))


def compose_collage(
    items: list[CollageItem],
    width: int,
    height: int,
    background_color: str,
    layout: CollageLayout = "auto",
) -> CollageResult:
    resolved_layout = _resolve_layout(items, layout)
    ordered_items = _sort_items(items)
    canvas = Image.new("RGBA", (width, height), parse_hex_color(background_color))
    boxes = _slot_boxes(len(ordered_items), resolved_layout, width, height)
    placements: list[Placement] = []

    for item, box in zip(ordered_items, boxes):
        fitted = _fit_image(item.image, box)
        left, top, right, bottom = box
        x = left + max(0, (right - left - fitted.width) // 2)
        y = top + max(0, (bottom - top - fitted.height) // 2)
        canvas.alpha_composite(fitted, (x, y))
        placements.append(Placement(x=x, y=y, width=fitted.width, height=fitted.height))

    return CollageResult(image=canvas, layout=resolved_layout, placements=placements)
