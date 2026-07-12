import numpy as np

from app.settings import Settings
from app.validators.person_pose import NormalizedBox, PersonPoseSummary
from app.validators.safety import SAFETY_FLAG_EXPLICIT, assess_safety


def _pose() -> PersonPoseSummary:
    return PersonPoseSummary(
        person_count=1,
        main_person_score=0.95,
        main_person_box=NormalizedBox(x=0.2, y=0.05, width=0.6, height=0.9),
        body_visibility="good",
        pose_confidence=0.9,
    )


def test_assess_safety_flags_high_exposed_skin_person_crop() -> None:
    image = np.zeros((800, 600, 3), dtype=np.uint8)
    image[:] = (235, 238, 242)
    image[40:760, 120:480] = (105, 172, 224)  # BGR skin-like tone.

    flags = assess_safety(image, _pose(), Settings())

    assert flags == [SAFETY_FLAG_EXPLICIT]


def test_assess_safety_allows_low_skin_ratio_clothed_photo() -> None:
    image = np.zeros((800, 600, 3), dtype=np.uint8)
    image[:] = (245, 248, 252)
    image[40:190, 220:380] = (105, 172, 224)
    image[190:760, 120:480] = (160, 80, 30)

    flags = assess_safety(image, _pose(), Settings())

    assert flags == []


def test_assess_safety_can_be_disabled() -> None:
    image = np.zeros((800, 600, 3), dtype=np.uint8)
    image[:] = (105, 172, 224)

    flags = assess_safety(image, _pose(), Settings(safety_heuristic_enabled=False))

    assert flags == []
