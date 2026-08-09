import numpy as np

from app.providers.grounded_sam import (
    Detection,
    ROLE_PROMPTS,
    keep_largest_components,
    select_detections,
)


def test_role_prompts_cover_mobile_garment_roles():
    assert {"top", "bottom", "dress", "shoes", "outerwear", "accessory"}.issubset(ROLE_PROMPTS)
    assert "polo shirt" in ROLE_PROMPTS["top"]
    assert "jeans" in ROLE_PROMPTS["bottom"]
    assert "sandal" in ROLE_PROMPTS["shoes"]
    assert {"glasses", "watch", "backpack", "jewelry"}.issubset(ROLE_PROMPTS["accessory"])


def test_select_detections_keeps_one_best_non_shoe_item():
    detections = [
        Detection((10, 10, 100, 100), 0.7, "shirt"),
        Detection((12, 12, 98, 98), 0.9, "t-shirt"),
    ]

    selected = select_detections(detections, "top")

    assert selected == [detections[1]]


def test_select_detections_keeps_two_distinct_shoes():
    detections = [
        Detection((10, 50, 90, 120), 0.9, "shoe"),
        Detection((12, 52, 88, 118), 0.8, "sneaker"),
        Detection((150, 50, 230, 120), 0.85, "shoe"),
    ]

    selected = select_detections(detections, "shoes")

    assert selected == [detections[0], detections[2]]


def test_select_detections_rejects_lower_body_box_for_top_role():
    detections = [
        Detection((20, 680, 300, 980), 0.9, "upper body garment"),
        Detection((20, 300, 300, 620), 0.7, "shirt"),
    ]

    selected = select_detections(detections, "top", (400, 1000))

    assert selected == [detections[1]]


def test_keep_largest_components_removes_small_mask_artifact():
    mask = np.zeros((20, 20), dtype=bool)
    mask[2:12, 2:12] = True
    mask[16:18, 16:18] = True

    cleaned = keep_largest_components(mask, 1)

    assert cleaned[5, 5]
    assert not cleaned[16, 16]


def test_keep_largest_components_can_preserve_a_pair_of_shoes():
    mask = np.zeros((20, 30), dtype=bool)
    mask[2:10, 2:10] = True
    mask[2:10, 18:26] = True
    mask[16:18, 14:16] = True

    cleaned = keep_largest_components(mask, 2)

    assert cleaned[5, 5]
    assert cleaned[5, 20]
    assert not cleaned[16, 14]
