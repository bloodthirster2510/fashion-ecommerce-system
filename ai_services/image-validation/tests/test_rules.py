from app.schemas import Quality
from app.settings import Settings
from app.validators.person_pose import NormalizedBox, PersonPoseSummary
from app.validators.quality import QualityAssessment
from app.validators.rules import evaluate_validation_rules


def quality_assessment(
    blur: str = "ok",
    brightness: str = "ok",
    resolution: str = "ok",
) -> QualityAssessment:
    return QualityAssessment(
        quality=Quality(blur=blur, brightness=brightness, resolution=resolution),
        blur_score=200.0,
        brightness_score=120.0,
    )


def good_pose() -> PersonPoseSummary:
    return PersonPoseSummary(
        person_count=1,
        main_person_score=0.91,
        main_person_box=NormalizedBox(x=0.2, y=0.05, width=0.55, height=0.85),
        body_visibility="good",
        pose_confidence=0.78,
        visible_regions=frozenset({"upper", "hips", "legs", "feet"}),
    )


def test_rejects_resolution_before_pose_rules():
    response = evaluate_validation_rules(
        quality_assessment(resolution="fail"),
        good_pose(),
        "full_set",
        Settings(),
    )

    assert response.allowed is False
    assert response.reasonCode == "IMAGE_TOO_SMALL"


def test_rejects_dark_image_before_blur_when_both_fail():
    response = evaluate_validation_rules(
        quality_assessment(blur="fail", brightness="fail"),
        good_pose(),
        "full_set",
        Settings(),
    )

    assert response.allowed is False
    assert response.reasonCode == "IMAGE_TOO_DARK"


def test_rejects_when_no_person_is_detected():
    response = evaluate_validation_rules(
        quality_assessment(),
        PersonPoseSummary(person_count=0),
        "single",
        Settings(),
    )

    assert response.allowed is False
    assert response.reasonCode == "NO_PERSON_DETECTED"


def test_allows_multiple_people():
    response = evaluate_validation_rules(
        quality_assessment(),
        PersonPoseSummary(person_count=2, main_person_score=0.88),
        "single",
        Settings(),
    )

    assert response.allowed is True
    assert response.reasonCode is None


def test_rejects_small_person_for_full_set():
    response = evaluate_validation_rules(
        quality_assessment(),
        PersonPoseSummary(
            person_count=1,
            main_person_score=0.9,
            main_person_box=NormalizedBox(x=0.45, y=0.2, width=0.12, height=0.25),
            body_visibility="good",
            pose_confidence=0.8,
        ),
        "full_set",
        Settings(),
    )

    assert response.allowed is False
    assert response.reasonCode == "PERSON_TOO_SMALL"


def test_rejects_partial_body_visibility():
    pose = good_pose()
    partial_pose = PersonPoseSummary(
        person_count=pose.person_count,
        main_person_score=pose.main_person_score,
        main_person_box=pose.main_person_box,
        body_visibility="partial",
        pose_confidence=pose.pose_confidence,
    )

    response = evaluate_validation_rules(
        quality_assessment(),
        partial_pose,
        "top_bottom",
        Settings(),
    )

    assert response.allowed is False
    assert response.reasonCode == "BODY_NOT_VISIBLE"


def test_allows_valid_single_person_image():
    response = evaluate_validation_rules(
        quality_assessment(),
        good_pose(),
        "full_set",
        Settings(),
    )

    assert response.allowed is True
    assert response.reasonCode is None
    assert response.personCount == 1
    assert response.recommendedMode == "full_set"
    assert response.supportedModes[:3] == ["full_set", "top_bottom", "top"]


def test_capabilities_describe_supported_modes_for_upper_body_photo():
    response = evaluate_validation_rules(
        quality_assessment(),
        PersonPoseSummary(
            person_count=1,
            main_person_score=0.91,
            main_person_box=NormalizedBox(x=0.2, y=0.05, width=0.55, height=0.5),
            body_visibility="good",
            pose_confidence=0.78,
            visible_regions=frozenset({"upper"}),
        ),
        "single",
        Settings(),
    )

    assert response.supportedModes == ["top", "outerwear", "accessory"]
    assert response.blockedModes["full_set"].reasonCode == "BODY_NOT_VISIBLE"
    assert response.capabilities[2].requiredRegions == ["upper"]
    assert response.blockedModes["shoes"].missingRegions == ["feet", "legs"]
