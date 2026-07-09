import base64
import binascii
from io import BytesIO

from PIL import Image


def decode_image_base64(image_base64: str, max_bytes: int) -> Image.Image:
    payload = image_base64.split(",", 1)[1] if "," in image_base64[:80] else image_base64
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("imageBase64 is not valid base64") from exc

    if len(raw) > max_bytes:
        raise ValueError("image is too large") from None

    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except Exception as exc:
        raise ValueError("image cannot be decoded") from exc

    return image.convert("RGBA")


def encode_png_base64(image: Image.Image) -> str:
    buffer = BytesIO()
    image.convert("RGBA").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def parse_hex_color(value: str) -> tuple[int, int, int, int]:
    cleaned = value.strip().lstrip("#")
    if len(cleaned) == 3:
        cleaned = "".join(char * 2 for char in cleaned)
    if len(cleaned) != 6:
        return (255, 255, 255, 255)
    try:
        return (
            int(cleaned[0:2], 16),
            int(cleaned[2:4], 16),
            int(cleaned[4:6], 16),
            255,
        )
    except ValueError:
        return (255, 255, 255, 255)
