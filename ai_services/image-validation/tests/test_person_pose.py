from app.validators.person_pose import _estimate_body_visibility, _estimate_visible_regions


def keypoints(*names: str) -> dict[str, float]:
    return {name: 0.9 for name in names}


def test_single_top_accepts_upper_body_visibility():
    visibility = _estimate_body_visibility(
        keypoints("left_shoulder", "right_shoulder"),
        "single",
        ["top"],
        0.25,
    )

    assert visibility == "good"


def test_estimates_visible_regions_once_for_capabilities():
    regions = _estimate_visible_regions(
        keypoints("left_shoulder", "left_hip", "left_knee", "left_ankle"),
        0.25,
    )

    assert regions == frozenset({"upper", "hips", "legs", "feet"})


def test_single_shoes_requires_ankles():
    visibility = _estimate_body_visibility(
        keypoints("left_shoulder", "right_shoulder", "left_hip", "left_knee"),
        "single",
        ["shoes"],
        0.25,
    )

    assert visibility == "partial"


def test_single_shoes_accepts_lower_body_with_ankles():
    visibility = _estimate_body_visibility(
        keypoints("left_knee", "right_ankle"),
        "single",
        ["shoes"],
        0.25,
    )

    assert visibility == "good"


def test_full_set_requires_leg_anchor():
    visibility = _estimate_body_visibility(
        keypoints("left_shoulder", "right_shoulder", "left_hip"),
        "full_set",
        ["top", "bottom"],
        0.25,
    )

    assert visibility == "partial"


def test_full_set_with_shoes_requires_ankles():
    visibility = _estimate_body_visibility(
        keypoints("left_shoulder", "right_shoulder", "left_hip", "left_knee"),
        "full_set",
        ["top", "bottom", "shoes"],
        0.25,
    )

    assert visibility == "partial"
