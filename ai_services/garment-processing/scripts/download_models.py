import argparse
import gc
import json
import os
from pathlib import Path


DEFAULT_DETECTOR = "IDEA-Research/grounding-dino-tiny"
DEFAULT_SEGMENTER = "facebook/sam2.1-hiera-tiny"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download garment extraction models.")
    parser.add_argument(
        "--cache-dir",
        default=os.getenv(
            "GARMENT_MODEL_CACHE_DIR",
            str(Path(__file__).resolve().parents[1] / "models" / "huggingface"),
        ),
    )
    parser.add_argument(
        "--detector",
        default=os.getenv("GARMENT_DETECTOR_MODEL_ID", DEFAULT_DETECTOR),
    )
    parser.add_argument(
        "--segmenter",
        default=os.getenv("GARMENT_SEGMENTER_MODEL_ID", DEFAULT_SEGMENTER),
    )
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cache_dir = Path(args.cache_dir).resolve()
    cache_dir.mkdir(parents=True, exist_ok=True)
    marker = cache_dir / "models-ready.json"
    expected = {
        "detector": args.detector,
        "segmenter": args.segmenter,
    }
    if marker.exists() and not args.force:
        current = json.loads(marker.read_text(encoding="utf-8"))
        if all(current.get(key) == value for key, value in expected.items()):
            print(f"Garment models are already available in {cache_dir}")
            return

    from transformers import (
        AutoModelForZeroShotObjectDetection,
        AutoProcessor,
        Sam2Model,
        Sam2Processor,
    )

    print(f"Downloading detector: {args.detector}")
    AutoProcessor.from_pretrained(args.detector, cache_dir=str(cache_dir))
    detector = AutoModelForZeroShotObjectDetection.from_pretrained(
        args.detector,
        cache_dir=str(cache_dir),
    )
    del detector
    gc.collect()

    print(f"Downloading segmenter: {args.segmenter}")
    Sam2Processor.from_pretrained(args.segmenter, cache_dir=str(cache_dir))
    segmenter = Sam2Model.from_pretrained(args.segmenter, cache_dir=str(cache_dir))
    del segmenter
    gc.collect()

    marker.write_text(
        json.dumps(expected, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Garment models downloaded to {cache_dir}")


if __name__ == "__main__":
    main()
