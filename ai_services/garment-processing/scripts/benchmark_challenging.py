import json
import sys
from dataclasses import replace
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.processors.composer import CollageItem, compose_collage
from app.processors.hybrid_extractor import HybridGarmentExtractor
from app.settings import Settings


def _fit_on_white(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, "white")
    item = image.convert("RGBA").copy()
    item.thumbnail((size[0] - 16, size[1] - 16), Image.Resampling.LANCZOS)
    canvas.alpha_composite(item, ((size[0] - item.width) // 2, (size[1] - item.height) // 2))
    return canvas.convert("RGB")


def main() -> None:
    sample_dir = SERVICE_ROOT / "samples" / "challenging-yody-cases"
    cases = json.loads((sample_dir / "cases.json").read_text(encoding="utf-8"))
    output_dir = sample_dir / "extracted-grounded-sam"
    output_dir.mkdir(exist_ok=True)

    settings = replace(
        Settings(),
        provider_name="grounded_sam",
        model_local_files_only=True,
    )
    extractor = HybridGarmentExtractor(settings)
    report: list[dict[str, object]] = []
    collage_items: dict[str, CollageItem] = {}
    thumb_width, thumb_height, label_height = 340, 390, 78
    sheet = Image.new(
        "RGB",
        (thumb_width * 2, (thumb_height + label_height) * len(cases)),
        "white",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, case in enumerate(cases):
        source = Image.open(sample_dir / case["sourceFile"])
        result = extractor.extract(source, case["role"])
        output_file = f"{case['id']}.png"
        result.image.save(output_dir / output_file)
        if result.is_usable and case["id"] in {
            "top-full-outfit-busy-background",
            "bottom-full-body-busy-background",
            "shoes-with-many-props",
        }:
            collage_items[case["role"]] = CollageItem(
                image=result.image,
                role=case["role"],
                label=case["id"],
            )
        report.append({
            "id": case["id"],
            "role": case["role"],
            "method": result.method,
            "confidence": round(result.confidence, 3),
            "isUsable": result.is_usable,
            "warnings": result.warnings,
            "issues": [
                {
                    "code": issue.code,
                    "severity": issue.severity,
                    "message": issue.message,
                }
                for issue in result.issues
            ],
            "bbox": list(result.bbox) if result.bbox else None,
            "extractedFile": f"extracted-grounded-sam/{output_file}",
        })

        y = index * (thumb_height + label_height)
        sheet.paste(_fit_on_white(source, (thumb_width, thumb_height)), (0, y))
        sheet.paste(_fit_on_white(result.image, (thumb_width, thumb_height)), (thumb_width, y))
        draw.text((8, y + thumb_height + 4), f"SOURCE | {case['id']}", fill="black", font=font)
        draw.text(
            (thumb_width + 8, y + thumb_height + 4),
            f"GROUNDED SAM | usable={result.is_usable}",
            fill="black",
            font=font,
        )
        draw.text(
            (thumb_width + 8, y + thumb_height + 22),
            f"confidence={result.confidence:.3f}",
            fill="black",
            font=font,
        )
        draw.text(
            (thumb_width + 8, y + thumb_height + 40),
            f"issues={','.join(issue.code for issue in result.issues) or '-'}",
            fill="black",
            font=font,
        )

    (sample_dir / "grounded-sam-report.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    sheet.save(sample_dir / "contact-grounded-sam.jpg", quality=92)
    if {"top", "bottom", "shoes"}.issubset(collage_items):
        collage = compose_collage(
            [
                collage_items["top"],
                collage_items["bottom"],
                collage_items["shoes"],
            ],
            width=768,
            height=768,
            background_color="#ffffff",
            layout="full_set",
        )
        collage.image.convert("RGB").save(
            sample_dir / "collage-grounded-sam-full-set.png",
        )
    usable = sum(bool(item["isUsable"]) for item in report)
    print(f"Grounded SAM benchmark completed: {usable}/{len(report)} usable")


if __name__ == "__main__":
    main()
