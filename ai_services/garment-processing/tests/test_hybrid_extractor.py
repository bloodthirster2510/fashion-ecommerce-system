from dataclasses import replace

from PIL import Image, ImageDraw

from app.processors.extractor import (
    ExtractionIssue,
    ExtractionResult,
    empty_extraction_result,
)
from app.processors.hybrid_extractor import HybridGarmentExtractor
from app.settings import Settings


class FakeModelProvider:
    def __init__(self, result: ExtractionResult):
        self.result = result
        self.calls = 0

    def status(self) -> dict[str, object]:
        return {"name": "fake", "state": "ready"}

    def warmup(self) -> None:
        return None

    def extract(self, _image, _role, _max_long_edge=None) -> ExtractionResult:
        self.calls += 1
        return self.result


def model_success() -> ExtractionResult:
    return ExtractionResult(
        image=Image.new("RGBA", (120, 140), (0, 90, 200, 255)),
        role="top",
        method="grounded_sam_box_crop",
        confidence=0.8,
        bbox=(20, 20, 140, 160),
        issues=[],
    )


def model_failure() -> ExtractionResult:
    return empty_extraction_result(
        "top",
        "grounded_sam_not_detected",
        ExtractionIssue(
            code="garment_not_detected",
            severity="error",
            message="No top garment could be detected.",
        ),
    )


def simple_product_image() -> Image.Image:
    image = Image.new("RGBA", (320, 420), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((90, 60, 230, 360), fill=(0, 90, 200, 255))
    return image


def complex_image() -> Image.Image:
    image = Image.new("RGBA", (320, 420), (50, 70, 90, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 160, 420), fill=(120, 80, 40, 255))
    draw.rectangle((100, 60, 240, 360), fill=(0, 90, 200, 255))
    return image


def test_hybrid_uses_heuristic_for_transparent_product_image():
    image = Image.new("RGBA", (300, 300), (255, 255, 255, 0))
    ImageDraw.Draw(image).rectangle((80, 60, 220, 250), fill=(0, 90, 200, 255))
    provider = FakeModelProvider(model_success())
    extractor = HybridGarmentExtractor(
        replace(Settings(), provider_name="hybrid"),
        provider,
    )

    result = extractor.extract(image, "top")

    assert result.method.startswith("heuristic_")
    assert provider.calls == 0


def test_hybrid_uses_model_for_opaque_image():
    provider = FakeModelProvider(model_success())
    extractor = HybridGarmentExtractor(
        replace(Settings(), provider_name="hybrid"),
        provider,
    )

    result = extractor.extract(complex_image(), "top")

    assert result.method == "grounded_sam_box_crop"
    assert provider.calls == 1


def test_hybrid_falls_back_only_for_simple_catalog_image():
    provider = FakeModelProvider(model_failure())
    extractor = HybridGarmentExtractor(
        replace(Settings(), provider_name="hybrid"),
        provider,
    )

    result = extractor.extract(simple_product_image(), "top")

    assert result.is_usable is True
    assert result.method.startswith("hybrid_fallback_")
    assert result.warnings == ["grounded_sam_fallback"]


def test_hybrid_does_not_hide_model_failure_for_complex_image():
    provider = FakeModelProvider(model_failure())
    extractor = HybridGarmentExtractor(
        replace(Settings(), provider_name="hybrid"),
        provider,
    )

    result = extractor.extract(complex_image(), "top")

    assert result.is_usable is False
    assert result.issues[0].code == "garment_not_detected"
