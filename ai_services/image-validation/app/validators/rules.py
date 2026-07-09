from app.schemas import BoundingBox, Quality, ValidationResponse
from app.settings import Settings
from app.validators.person_pose import NormalizedBox, PersonPoseSummary
from app.validators.quality import QualityAssessment


def _box_to_schema(box: NormalizedBox | None) -> BoundingBox | None:
    if box is None:
        return None
    return BoundingBox(
        x=max(0.0, min(1.0, box.x)),
        y=max(0.0, min(1.0, box.y)),
        width=max(0.0, min(1.0, box.width)),
        height=max(0.0, min(1.0, box.height)),
    )


def _empty_pose() -> PersonPoseSummary:
    return PersonPoseSummary(person_count=0)


def _too_small(pose: PersonPoseSummary, outfit_mode: str | None, settings: Settings) -> bool:
    if pose.main_person_box is None:
        return False

    if outfit_mode == "single":
        min_area = settings.single_min_box_area_ratio
        min_height = settings.single_min_box_height_ratio
    else:
        min_area = settings.outfit_min_box_area_ratio
        min_height = settings.outfit_min_box_height_ratio

    return pose.main_person_box.area < min_area or pose.main_person_box.height < min_height


def _response(
    allowed: bool,
    reason_code: str | None,
    quality: Quality,
    pose: PersonPoseSummary | None = None,
    safety_flags: list[str] | None = None,
) -> ValidationResponse:
    pose = pose or _empty_pose()
    return ValidationResponse(
        allowed=allowed,
        reasonCode=reason_code,
        message=None,
        personCount=pose.person_count,
        mainPersonScore=pose.main_person_score,
        mainPersonBox=_box_to_schema(pose.main_person_box),
        bodyVisibility=pose.body_visibility,  # type: ignore[arg-type]
        poseConfidence=pose.pose_confidence,
        quality=quality,
        safetyFlags=safety_flags or [],
    )


def evaluate_validation_rules(
    quality_assessment: QualityAssessment,
    pose: PersonPoseSummary | None,
    outfit_mode: str | None,
    settings: Settings,
    safety_flags: list[str] | None = None,
) -> ValidationResponse:
    quality = quality_assessment.quality
    flags = safety_flags or []

    if flags:
        return _response(False, "IMAGE_POLICY_BLOCKED", quality, pose, flags)
    if quality.resolution == "fail":
        return _response(False, "IMAGE_TOO_SMALL", quality, pose, flags)
    if quality.brightness == "fail":
        return _response(False, "IMAGE_TOO_DARK", quality, pose, flags)
    if quality.blur == "fail":
        return _response(False, "IMAGE_TOO_BLURRY", quality, pose, flags)

    if pose is None or pose.person_count < 1:
        return _response(False, "NO_PERSON_DETECTED", quality, pose, flags)
    if pose.person_count > 1:
        return _response(False, "MULTIPLE_PEOPLE_DETECTED", quality, pose, flags)
    if pose.main_person_score < settings.person_score_threshold:
        return _response(False, "NO_PERSON_DETECTED", quality, pose, flags)
    if _too_small(pose, outfit_mode, settings):
        return _response(False, "PERSON_TOO_SMALL", quality, pose, flags)
    if pose.body_visibility == "partial":
        return _response(False, "BODY_NOT_VISIBLE", quality, pose, flags)
    if pose.pose_confidence is not None and pose.pose_confidence < settings.pose_confidence_threshold:
        return _response(False, "POSE_NOT_SUPPORTED", quality, pose, flags)

    return _response(True, None, quality, pose, flags)
