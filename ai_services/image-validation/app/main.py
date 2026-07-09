import logging

from fastapi import FastAPI, HTTPException

from app.schemas import ValidationRequest, ValidationResponse
from app.settings import load_settings
from app.validators.person_pose import YoloPoseDetector
from app.validators.quality import assess_quality, decode_image_base64
from app.validators.rules import evaluate_validation_rules


logger = logging.getLogger("image-validation")
settings = load_settings()
pose_detector = YoloPoseDetector(settings)

app = FastAPI(
    title="Fashion Try-On Image Validation",
    version="1.0.0",
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "provider": settings.provider_name,
        "poseModel": settings.yolo_pose_model,
    }


@app.post("/validate-image", response_model=ValidationResponse)
def validate_image(payload: ValidationRequest) -> ValidationResponse:
    try:
        image = decode_image_base64(payload.imageBase64, settings.max_image_bytes)
    except ValueError:
        return ValidationResponse(
            allowed=False,
            reasonCode="IMAGE_POLICY_BLOCKED",
            message=None,
            personCount=0,
            mainPersonScore=0.0,
            mainPersonBox=None,
            bodyVisibility="unknown",
            poseConfidence=None,
            quality={"blur": "warn", "brightness": "warn", "resolution": "warn"},
            safetyFlags=[],
        )

    quality = assess_quality(image, payload.width, payload.height, settings)
    if (
        quality.quality.resolution == "fail"
        or quality.quality.blur == "fail"
        or quality.quality.brightness == "fail"
    ):
        return evaluate_validation_rules(quality, None, payload.outfitMode, settings)

    try:
        pose = pose_detector.detect(image, payload.outfitMode, payload.itemRoles)
    except Exception as exc:
        logger.exception("Pose validation failed")
        raise HTTPException(status_code=503, detail="Validation model failed") from exc

    return evaluate_validation_rules(quality, pose, payload.outfitMode, settings)
