from PIL import Image, ImageDraw

from app.processors.extractor import extraction_from_box, extract_garment
from app.settings import Settings


def outfit_image() -> Image.Image:
    image = Image.new("RGBA", (400, 600), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((120, 70, 280, 270), fill=(0, 96, 220, 255))
    draw.rectangle((145, 270, 195, 530), fill=(40, 90, 150, 255))
    draw.rectangle((205, 270, 255, 530), fill=(40, 90, 150, 255))
    return image


def test_extract_top_from_outfit_image_keeps_upper_region():
    result = extract_garment(outfit_image(), "top", Settings())

    assert result.image.height < 360
    assert result.image.width > 120
    assert result.confidence > 0
    assert result.bbox is not None
    assert result.bbox[1] < 100


def test_extract_top_product_only_keeps_whole_garment():
    image = Image.new("RGBA", (340, 420), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((105, 65, 235, 360), fill=(0, 96, 220, 255))
    draw.polygon([(105, 95), (55, 180), (105, 205)], fill=(0, 96, 220, 255))
    draw.polygon([(235, 95), (285, 180), (235, 205)], fill=(0, 96, 220, 255))

    result = extract_garment(image, "top", Settings())

    assert result.method == "heuristic_box_crop"
    assert result.image.getpixel((0, 0)) == (255, 255, 255, 255)
    assert result.image.height > 280
    assert result.bbox is not None
    assert result.bbox[3] > 350


def test_extract_bottom_from_outfit_image_keeps_lower_region():
    result = extract_garment(outfit_image(), "bottom", Settings())

    assert result.image.height > 220
    assert result.image.width > 80
    assert result.confidence > 0
    assert result.bbox is not None
    assert result.bbox[1] > 200


def test_extract_bottom_product_only_keeps_whole_garment():
    image = Image.new("RGBA", (320, 620), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((95, 60, 225, 120), fill=(40, 90, 150, 255))
    draw.rectangle((105, 120, 155, 560), fill=(40, 90, 150, 255))
    draw.rectangle((165, 120, 215, 560), fill=(40, 90, 150, 255))

    result = extract_garment(image, "bottom", Settings())

    assert result.method == "heuristic_box_crop"
    assert result.image.getpixel((0, 0)) == (255, 255, 255, 255)
    assert result.image.height > 500
    assert result.bbox is not None
    assert result.bbox[1] < 80


def test_extract_shoes_keeps_whole_product_foreground():
    image = Image.new("RGBA", (420, 260), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.ellipse((70, 95, 210, 170), fill=(30, 30, 30, 255))
    draw.ellipse((200, 95, 350, 170), fill=(30, 30, 30, 255))

    result = extract_garment(image, "shoes", Settings())

    assert result.image.height > 70
    assert result.image.width > 260
    assert result.confidence > 0


def test_extract_alpha_png_uses_alpha_only_to_locate_crop():
    image = Image.new("RGBA", (300, 300), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((80, 80, 220, 220), fill=(255, 0, 0, 255))

    result = extract_garment(image, "accessory", Settings())

    assert result.image.width <= 160
    assert result.image.height <= 160
    assert result.confidence > 0.2
    assert result.method == "heuristic_box_crop"
    assert result.image.getpixel((0, 0))[3] == 0


def test_extract_empty_image_marks_result_unusable():
    image = Image.new("RGBA", (320, 320), (255, 255, 255, 255))

    result = extract_garment(image, "top", Settings())

    assert result.is_usable is False
    assert result.warnings == []
    assert [issue.code for issue in result.issues] == ["empty_mask"]


def test_extract_from_box_keeps_original_pixels_inside_crop():
    image = Image.new("RGBA", (200, 200), (20, 40, 60, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((60, 50, 140, 150), fill=(0, 96, 220, 255))

    result = extraction_from_box(
        image=image,
        box=(60, 50, 141, 151),
        role="top",
        settings=Settings(crop_padding_ratio=0),
        method="grounded_sam_box_crop",
        confidence=0.8,
    )

    assert result.image.size == (81, 101)
    assert result.image.getpixel((0, 0)) == (0, 96, 220, 255)
    assert result.method == "grounded_sam_box_crop"
