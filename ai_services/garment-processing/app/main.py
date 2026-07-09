from fastapi import FastAPI, HTTPException

from app.processors.composer import CollageItem, compose_collage
from app.processors.extractor import extract_garment
from app.processors.image_io import decode_image_base64, encode_png_base64
from app.schemas import (
    BoundingBox,
    ComposeCollageRequest,
    ComposeCollageResponse,
    ExtractGarmentRequest,
    ExtractGarmentResponse,
    PrepareCollageRequest,
    PrepareCollageResponse,
)
from app.settings import load_settings


settings = load_settings()

app = FastAPI(
    title="Fashion Garment Processing",
    version="1.0.0",
)


def _bbox_from_tuple(value: tuple[int, int, int, int] | None) -> BoundingBox | None:
    if value is None:
        return None
    left, top, right, bottom = value
    return BoundingBox(x=left, y=top, width=max(0, right - left), height=max(0, bottom - top))


def _extract_response(request: ExtractGarmentRequest) -> tuple[ExtractGarmentResponse, CollageItem]:
    try:
        source = decode_image_base64(request.imageBase64, settings.max_image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = extract_garment(source, request.role, settings, request.maxLongEdge)
    response = ExtractGarmentResponse(
        imageBase64=encode_png_base64(result.image),
        width=result.image.width,
        height=result.image.height,
        role=result.role,
        method=result.method,
        confidence=result.confidence,
        bbox=_bbox_from_tuple(result.bbox),
    )
    return response, CollageItem(image=result.image, role=request.role, label=request.label)


def _compose_response(request: ComposeCollageRequest, items: list[CollageItem]) -> ComposeCollageResponse:
    result = compose_collage(
        items,
        width=request.width,
        height=request.height,
        background_color=request.backgroundColor,
        layout=request.layout,
    )
    return ComposeCollageResponse(
        imageBase64=encode_png_base64(result.image),
        width=result.image.width,
        height=result.image.height,
        layout=result.layout,
        placements=[
            BoundingBox(x=item.x, y=item.y, width=item.width, height=item.height)
            for item in result.placements
        ],
    )


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "provider": "heuristic",
        "canvas": {
            "width": settings.default_canvas_width,
            "height": settings.default_canvas_height,
        },
    }


@app.post("/extract-garment", response_model=ExtractGarmentResponse)
def extract_garment_endpoint(request: ExtractGarmentRequest) -> ExtractGarmentResponse:
    response, _item = _extract_response(request)
    return response


@app.post("/compose-collage", response_model=ComposeCollageResponse)
def compose_collage_endpoint(request: ComposeCollageRequest) -> ComposeCollageResponse:
    items: list[CollageItem] = []
    for item in request.items:
        try:
            image = decode_image_base64(item.imageBase64, settings.max_image_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        items.append(CollageItem(image=image, role=item.role, label=item.label))

    return _compose_response(request, items)


@app.post("/prepare-collage", response_model=PrepareCollageResponse)
def prepare_collage_endpoint(request: PrepareCollageRequest) -> PrepareCollageResponse:
    extracted: list[ExtractGarmentResponse] = []
    items: list[CollageItem] = []
    for item in request.items:
        response, collage_item = _extract_response(ExtractGarmentRequest(
            imageBase64=item.imageBase64,
            mimeType=item.mimeType,
            role=item.role,
            label=item.label,
            maxLongEdge=request.maxLongEdge,
        ))
        extracted.append(response)
        items.append(collage_item)

    compose_request = ComposeCollageRequest(
        items=[
            {
                "imageBase64": response.imageBase64,
                "role": response.role,
                "mimeType": response.mimeType,
            }
            for response in extracted
        ],
        layout=request.layout,
        width=request.width,
        height=request.height,
        backgroundColor=request.backgroundColor,
    )
    composed = _compose_response(compose_request, items)
    return PrepareCollageResponse(
        **composed.model_dump(),
        extractedItems=extracted,
    )
