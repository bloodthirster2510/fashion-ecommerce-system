import base64

import cv2
import numpy as np

from app.settings import Settings
from app.validators.quality import assess_quality, decode_image_base64


def test_decode_image_base64_accepts_valid_jpeg():
    image = np.full((500, 500, 3), 128, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok

    decoded = decode_image_base64(base64.b64encode(encoded.tobytes()).decode("ascii"), 2_000_000)

    assert decoded.shape[0] == 500
    assert decoded.shape[1] == 500


def test_quality_marks_low_resolution_as_fail():
    image = np.full((120, 120, 3), 128, dtype=np.uint8)

    result = assess_quality(image, 120, 120, Settings(min_width=400, min_height=400))

    assert result.quality.resolution == "fail"


def test_quality_marks_dark_image_as_fail():
    image = np.zeros((500, 500, 3), dtype=np.uint8)

    result = assess_quality(image, 500, 500, Settings())

    assert result.quality.brightness == "fail"


def test_quality_marks_flat_image_as_blurry():
    image = np.full((500, 500, 3), 128, dtype=np.uint8)

    result = assess_quality(image, 500, 500, Settings())

    assert result.quality.blur == "fail"
