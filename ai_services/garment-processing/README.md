# Garment Processing Service

FastAPI service for product-image preprocessing before virtual try-on.

It does two jobs before ComfyUI:

- Extract the requested garment region from a product image using the selected `role`.
- Compose the extracted garments into one white-background collage image.

This MVP is intentionally credit-free. It uses Pillow and NumPy heuristics:

- alpha mask when PNG transparency exists
- foreground detection against the image corner background
- role-aware crop bands for `top`, `bottom`, `dress`, `shoes`, `outerwear`, `accessory`

It is suitable for pipeline testing and catalog images with clean backgrounds. For
production-grade clothing masks, plug in a segmentation provider later
(GroundingDINO + SAM, fashion parsing, or a custom model).

## Run locally

```powershell
cd ai_services/garment-processing
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 7002
```

## API

```http
GET /health
POST /extract-garment
POST /compose-collage
POST /prepare-collage
```

Use `/prepare-collage` for the app flow:

```json
{
  "items": [
    { "imageBase64": "...", "role": "top" },
    { "imageBase64": "...", "role": "bottom" }
  ],
  "layout": "auto",
  "width": 768,
  "height": 768,
  "backgroundColor": "#ffffff"
}
```

The response returns `imageBase64` as a PNG garment collage. Send that collage to
ComfyUI as the single `garmentImage`.

## Backend configuration

```env
VIRTUAL_TRY_ON_GARMENT_PROCESSING_URL=http://127.0.0.1:7002/prepare-collage
VIRTUAL_TRY_ON_GARMENT_PROCESSING_TIMEOUT_MS=30000
VIRTUAL_TRY_ON_GARMENT_PROCESSING_FAIL_OPEN=true
```

When this URL is set and the Comfy workflow map contains `garmentImage`, the
backend sends selected catalog images to this service first, uploads the returned
collage to ComfyUI, then maps that file to the workflow's garment input.

## Tests

```powershell
cd ai_services/garment-processing
pytest
```

## Current limitations

- Heuristic extraction will not be perfect on busy backgrounds.
- Product photos with overlapping garments may need a stronger segmentation model.
- This service does not run the final try-on; ComfyUI still handles `person + garment collage`.
