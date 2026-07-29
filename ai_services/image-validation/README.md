# Image Validation Service

FastAPI service used by the virtual try-on backend before sending a job to ComfyUI.
It validates that the source image is suitable for try-on:

- basic quality with OpenCV: resolution, blur, brightness
- person and role-aware body visibility with YOLO Pose
- try-on capability mapping for `full_set`, `top_bottom`, `top`, `bottom`, `dress`, `shoes`, `outerwear`, and `accessory`
- rule mapping to the existing backend reason codes

## Run locally

```powershell
cd ai_services/image-validation
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 7001
```

The first request may download the YOLO pose model. To pin a local model file:

```powershell
$env:IMAGE_VALIDATION_YOLO_POSE_MODEL="models/yolo11n-pose.pt"
```

## Backend configuration

```env
IMAGE_VALIDATION_PROVIDER=auto
IMAGE_VALIDATION_CUSTOM_MODEL_URL=http://127.0.0.1:7001/validate-image
IMAGE_VALIDATION_CUSTOM_MODEL_HEALTH_URL=http://127.0.0.1:7001/health
IMAGE_VALIDATION_CUSTOM_MODEL_TIMEOUT_MS=15000
IMAGE_VALIDATION_HEALTH_TIMEOUT_MS=2000
IMAGE_VALIDATION_FAIL_OPEN=false
```

`auto` selects `custom_model` when its URL is configured and otherwise uses `mock`
in development/test. Production never falls back to mock and always forces
fail-closed, even if `IMAGE_VALIDATION_FAIL_OPEN=true` is accidentally set.

## API

```http
GET /health
POST /validate-image
```

`POST /validate-image` accepts the same payload sent by
`backend/src/modules/virtual-try-on/image-validation/custom-model-image-validation.provider.ts`
and returns fields compatible with `ImageValidationResult`. The backend also sends
`itemRoles` (`top`, `bottom`, `dress`, `shoes`, `accessory`, `outerwear`) so the
service can require the right visible body regions for the current mobile try-on
mode. The response includes `visibleRegions`, `supportedModes`, `blockedModes`,
`recommendedMode`, and per-mode `capabilities` so the app can explain which
try-on choices the same source photo can support.

## Tests

```powershell
cd ai_services/image-validation
pytest
```

## Important thresholds

All thresholds are environment-driven:

- `IMAGE_VALIDATION_MIN_WIDTH`, `IMAGE_VALIDATION_MIN_HEIGHT`
- `IMAGE_VALIDATION_BLUR_FAIL_THRESHOLD`
- `IMAGE_VALIDATION_BLUR_WARN_THRESHOLD` or legacy `IMAGE_VALIDATION_BLUR_THRESHOLD`
- `IMAGE_VALIDATION_BRIGHTNESS_MIN`, `IMAGE_VALIDATION_BRIGHTNESS_MAX`
- `IMAGE_VALIDATION_PERSON_CONFIDENCE_THRESHOLD`
- `IMAGE_VALIDATION_PERSON_SCORE_THRESHOLD`
- `IMAGE_VALIDATION_KEYPOINT_CONFIDENCE_THRESHOLD`
- `IMAGE_VALIDATION_POSE_CONFIDENCE_THRESHOLD`
- `IMAGE_VALIDATION_SINGLE_MIN_BOX_AREA_RATIO`
- `IMAGE_VALIDATION_SINGLE_MIN_BOX_HEIGHT_RATIO`
- `IMAGE_VALIDATION_OUTFIT_MIN_BOX_AREA_RATIO`
- `IMAGE_VALIDATION_OUTFIT_MIN_BOX_HEIGHT_RATIO`
