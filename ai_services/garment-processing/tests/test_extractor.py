from PIL import Image, ImageDraw

from app.processors.extractor import extract_garment
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


def test_extract_bottom_from_outfit_image_keeps_lower_region():
    result = extract_garment(outfit_image(), "bottom", Settings())

    assert result.image.height > 220
    assert result.image.width > 80
    assert result.confidence > 0
    assert result.bbox is not None
    assert result.bbox[1] > 200


def test_extract_shoes_keeps_whole_product_foreground():
    image = Image.new("RGBA", (420, 260), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.ellipse((70, 95, 210, 170), fill=(30, 30, 30, 255))
    draw.ellipse((200, 95, 350, 170), fill=(30, 30, 30, 255))

    result = extract_garment(image, "shoes", Settings())

    assert result.image.height > 70
    assert result.image.width > 260
    assert result.confidence > 0


def test_extract_alpha_png_uses_alpha_mask():
    image = Image.new("RGBA", (300, 300), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((80, 80, 220, 220), fill=(255, 0, 0, 255))

    result = extract_garment(image, "accessory", Settings())

    assert result.image.width <= 160
    assert result.image.height <= 160
    assert result.confidence > 0.2
