from app.schemas import BodyRegion, BoundingBox, CapabilityMode, ImageCapability, Quality, ValidationResponse
from app.settings import Settings
from app.validators.person_pose import NormalizedBox, PersonPoseSummary
from app.validators.quality import QualityAssessment

CAPABILITY_ORDER: list[CapabilityMode] = [
    "full_set",
    "top_bottom",
    "top",
    "bottom",
    "dress",
    "shoes",
    "outerwear",
    "accessory",
]

CAPABILITY_REQUIRED_REGIONS: dict[CapabilityMode, set[BodyRegion]] = {
    "full_set": {"upper", "hips", "legs"},
    "top_bottom": {"upper", "hips", "legs"},
    "top": {"upper"},
    "bottom": {"hips", "legs"},
    "dress": {"upper", "hips", "legs"},
    "shoes": {"legs", "feet"},
    "outerwear": {"upper"},
    "accessory": {"upper"},
}


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


def _uses_outfit_size_threshold(mode: str | None) -> bool:
    return mode in {"full_set", "top_bottom"}


def _too_small(pose: PersonPoseSummary, mode: str | None, settings: Settings) -> bool:
    if pose.main_person_box is None:
        return False

    if _uses_outfit_size_threshold(mode):
        min_area = settings.outfit_min_box_area_ratio
        min_height = settings.outfit_min_box_height_ratio
    else:
        min_area = settings.single_min_box_area_ratio
        min_height = settings.single_min_box_height_ratio

    return pose.main_person_box.area < min_area or pose.main_person_box.height < min_height


def _quality_reason(quality: Quality) -> str | None:
    if quality.resolution == "fail":
        return "IMAGE_TOO_SMALL"
    if quality.brightness == "fail":
        return "IMAGE_TOO_DARK"
    if quality.blur == "fail":
        return "IMAGE_TOO_BLURRY"
    return None


def _base_pose_reason(
    quality: Quality,
    pose: PersonPoseSummary | None,
    settings: Settings,
    safety_flags: list[str],
) -> str | None:
    if safety_flags:
        return "IMAGE_POLICY_BLOCKED"

    quality_reason = _quality_reason(quality)
    if quality_reason:
        return quality_reason

    if pose is None or pose.person_count < 1:
        return "NO_PERSON_DETECTED"
    if pose.main_person_score < settings.person_score_threshold:
        return "NO_PERSON_DETECTED"
    if pose.pose_confidence is not None and pose.pose_confidence < settings.pose_confidence_threshold:
        return "POSE_NOT_SUPPORTED"
    return None


def _capability_reason(
    mode: CapabilityMode,
    quality: Quality,
    pose: PersonPoseSummary | None,
    settings: Settings,
    safety_flags: list[str],
) -> tuple[str | None, list[BodyRegion]]:
    base_reason = _base_pose_reason(quality, pose, settings, safety_flags)
    if base_reason:
        return base_reason, []

    pose = pose or _empty_pose()
    if _too_small(pose, mode, settings):
        return "PERSON_TOO_SMALL", []

    required_regions = CAPABILITY_REQUIRED_REGIONS[mode]
    missing_regions = sorted(required_regions.difference(pose.visible_regions))
    if missing_regions:
        return "BODY_NOT_VISIBLE", missing_regions

    return None, []


def _build_capabilities(
    quality: Quality,
    pose: PersonPoseSummary | None,
    settings: Settings,
    safety_flags: list[str],
) -> list[ImageCapability]:
    capabilities: list[ImageCapability] = []
    for mode in CAPABILITY_ORDER:
        required_regions = sorted(CAPABILITY_REQUIRED_REGIONS[mode])
        reason_code, missing_regions = _capability_reason(mode, quality, pose, settings, safety_flags)
        capabilities.append(
            ImageCapability(
                mode=mode,
                allowed=reason_code is None,
                reasonCode=reason_code,  # type: ignore[arg-type]
                message=None,
                requiredRegions=required_regions,
                missingRegions=missing_regions,
            )
        )
    return capabilities


def _response(
    allowed: bool,
    reason_code: str | None,
    quality: Quality,
    settings: Settings,
    pose: PersonPoseSummary | None = None,
    safety_flags: list[str] | None = None,
) -> ValidationResponse:
    pose = pose or _empty_pose()
    flags = safety_flags or []
    capabilities = _build_capabilities(quality, pose, settings, flags)
    supported_modes = [capability.mode for capability in capabilities if capability.allowed]
    blocked_modes = {
        capability.mode: {
            "reasonCode": capability.reasonCode,
            "message": capability.message,
            "missingRegions": capability.missingRegions,
        }
        for capability in capabilities
        if not capability.allowed
    }

    return ValidationResponse(
        allowed=allowed,
        reasonCode=reason_code,  # type: ignore[arg-type]
        message=None,
        personCount=pose.person_count,
        mainPersonScore=pose.main_person_score,
        mainPersonBox=_box_to_schema(pose.main_person_box),
        bodyVisibility=pose.body_visibility,  # type: ignore[arg-type]
        poseConfidence=pose.pose_confidence,
        quality=quality,
        safetyFlags=flags,
        visibleRegions=sorted(pose.visible_regions),
        supportedModes=supported_modes,
        blockedModes=blocked_modes,
        recommendedMode=supported_modes[0] if supported_modes else None,
        capabilities=capabilities,
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
        return _response(False, "IMAGE_POLICY_BLOCKED", quality, settings, pose, flags)
    if quality.resolution == "fail":
        return _response(False, "IMAGE_TOO_SMALL", quality, settings, pose, flags)
    if quality.brightness == "fail":
        return _response(False, "IMAGE_TOO_DARK", quality, settings, pose, flags)
    if quality.blur == "fail":
        return _response(False, "IMAGE_TOO_BLURRY", quality, settings, pose, flags)

    if pose is None or pose.person_count < 1:
        return _response(False, "NO_PERSON_DETECTED", quality, settings, pose, flags)
    if pose.main_person_score < settings.person_score_threshold:
        return _response(False, "NO_PERSON_DETECTED", quality, settings, pose, flags)
    if _too_small(pose, outfit_mode, settings):
        return _response(False, "PERSON_TOO_SMALL", quality, settings, pose, flags)
    if pose.body_visibility == "partial":
        return _response(False, "BODY_NOT_VISIBLE", quality, settings, pose, flags)
    if pose.pose_confidence is not None and pose.pose_confidence < settings.pose_confidence_threshold:
        return _response(False, "POSE_NOT_SUPPORTED", quality, settings, pose, flags)

    return _response(True, None, quality, settings, pose, flags)
