from io import BytesIO
import base64
from dataclasses import replace

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import pytest

import app.main as main_module
from app.processors.hybrid_extractor import HybridGarmentExtractor


app = main_module.app


client = TestClient(app)


@pytest.fixture(autouse=True)
def use_heuristic_provider(monkeypatch):
    extractor = HybridGarmentExtractor(
        replace(main_module.settings, provider_name="heuristic"),
    )
    monkeypatch.setattr(main_module, "garment_extractor", extractor)


def image_base64() -> str:
    image = Image.new("RGBA", (320, 420), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((90, 40, 230, 180), fill=(0, 96, 220, 255))
    draw.rectangle((110, 180, 150, 380), fill=(50, 80, 130, 255))
    draw.rectangle((170, 180, 210, 380), fill=(50, 80, 130, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_prepare_collage_extracts_and_composes_items():
    source = image_base64()
    response = client.post(
        "/prepare-collage",
        json={
            "items": [
                {"imageBase64": source, "role": "top"},
                {"imageBase64": source, "role": "bottom"},
            ],
            "layout": "auto",
            "width": 768,
            "height": 768,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["layout"] == "top_bottom"
    assert payload["width"] == 768
    assert len(payload["extractedItems"]) == 2
    assert len(payload["placements"]) == 2
    assert payload["extractedItems"][0]["isUsable"] is True
    assert payload["extractedItems"][0]["issues"] == []


def test_extract_garment_reports_unusable_empty_image():
    image = Image.new("RGBA", (320, 320), (255, 255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")

    response = client.post(
        "/extract-garment",
        json={
            "imageBase64": base64.b64encode(buffer.getvalue()).decode("ascii"),
            "role": "top",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["isUsable"] is False
    assert payload["issues"][0]["code"] == "empty_mask"
    assert payload["issues"][0]["severity"] == "error"
