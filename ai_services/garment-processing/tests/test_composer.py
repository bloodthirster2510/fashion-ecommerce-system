from PIL import Image

from app.processors.composer import CollageItem, compose_collage


def test_compose_top_bottom_places_two_items():
    top = Image.new("RGBA", (200, 260), (0, 90, 220, 255))
    bottom = Image.new("RGBA", (180, 320), (40, 90, 150, 255))

    result = compose_collage(
        [CollageItem(top, "top"), CollageItem(bottom, "bottom")],
        768,
        768,
        "#ffffff",
        "auto",
    )

    assert result.layout == "top_bottom"
    assert len(result.placements) == 2
    assert result.placements[0].x < result.placements[1].x


def test_compose_full_set_uses_three_slots():
    item = Image.new("RGBA", (200, 200), (0, 0, 0, 255))

    result = compose_collage(
        [
            CollageItem(item, "top"),
            CollageItem(item, "bottom"),
            CollageItem(item, "shoes"),
        ],
        768,
        768,
        "#ffffff",
        "auto",
    )

    assert result.layout == "full_set"
    assert len(result.placements) == 3
    assert result.placements[2].y > result.placements[0].y
