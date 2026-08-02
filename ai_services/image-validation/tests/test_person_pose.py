import numpy as np

from app.validators.person_pose import (
    _count_distinct_person_boxes,
    _estimate_body_visibility,
    _estimate_visible_regions,
)


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


def test_full_set_bottom_and_shoes_does_not_require_upper_body():
    visibility = _estimate_body_visibility(
        keypoints("left_hip", "left_knee", "right_ankle"),
        "full_set",
        ["bottom", "shoes"],
        0.25,
    )

    assert visibility == "good"


def test_nested_partial_and_full_body_boxes_count_as_one_person():
    boxes = np.array(
        [
            [0.0450, 0.1518, 0.5253, 0.6421],
            [0.1944, 0.2607, 0.7349, 0.9549],
            [0.0325, 0.1649, 0.7036, 0.8872],
        ],
        dtype=np.float32,
    )

    assert _count_distinct_person_boxes(boxes) == 1


def test_overlapping_person_boxes_without_containment_remain_distinct():
    boxes = np.array(
        [
            [10.0, 10.0, 110.0, 210.0],
            [60.0, 20.0, 160.0, 220.0],
        ],
        dtype=np.float32,
    )

    assert _count_distinct_person_boxes(boxes) == 2


def test_nested_duplicate_and_separate_person_count_as_two_people():
    boxes = np.array(
        [
            [10.0, 10.0, 110.0, 210.0],
            [20.0, 20.0, 100.0, 200.0],
            [150.0, 20.0, 250.0, 220.0],
        ],
        dtype=np.float32,
    )

    assert _count_distinct_person_boxes(boxes) == 2
