from dataclasses import replace

from PIL import Image

from app.processors.extractor import (
    ExtractionIssue,
    ExtractionResult,
    GarmentRole,
    extract_garment,
    has_transparency,
    is_simple_catalog_image,
)
from app.providers.grounded_sam import GroundedSamProvider
from app.settings import Settings


class HybridGarmentExtractor:
    def __init__(
        self,
        settings: Settings,
        model_provider: GroundedSamProvider | None = None,
    ):
        self.settings = settings
        self.model_provider = model_provider or GroundedSamProvider(settings)

    def status(self) -> dict[str, object]:
        return {
            "mode": self.settings.provider_name,
            "model": self.model_provider.status(),
        }

    def warmup(self) -> None:
        if self.settings.provider_name in {"hybrid", "grounded_sam"}:
            self.model_provider.warmup()

    def extract(
        self,
        image: Image.Image,
        role: GarmentRole,
        max_long_edge: int | None = None,
    ) -> ExtractionResult:
        mode = self.settings.provider_name
        if mode == "heuristic":
            return extract_garment(image, role, self.settings, max_long_edge)

        if mode not in {"hybrid", "grounded_sam"}:
            return replace(
                extract_garment(image, role, self.settings, max_long_edge),
                issues=[
                    ExtractionIssue(
                        code="unknown_provider",
                        severity="error",
                        message=f"Unknown garment extraction provider: {mode}",
                    ),
                ],
            )

        if mode == "hybrid" and has_transparency(image):
            return extract_garment(image, role, self.settings, max_long_edge)

        model_result = self.model_provider.extract(image, role, max_long_edge)
        if model_result.is_usable or mode == "grounded_sam":
            return model_result

        if not is_simple_catalog_image(image, self.settings):
            return model_result

        heuristic_result = extract_garment(image, role, self.settings, max_long_edge)
        if not heuristic_result.is_usable or "ambiguous_foreground" in heuristic_result.warnings:
            return model_result

        fallback_issue = ExtractionIssue(
            code="grounded_sam_fallback",
            severity="warning",
            message="Grounded SAM could not extract this simple image; heuristic extraction was used.",
        )
        return replace(
            heuristic_result,
            method=f"hybrid_fallback_{heuristic_result.method}",
            issues=[*heuristic_result.issues, fallback_issue],
        )
