from typing import Literal

from pydantic import BaseModel, Field


GarmentRole = Literal["top", "bottom", "dress", "shoes", "accessory", "outerwear"]
CollageLayout = Literal["auto", "single", "top_bottom", "full_set", "horizontal"]


class BoundingBox(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=0)
    height: int = Field(ge=0)


class GarmentImageInput(BaseModel):
    imageBase64: str = Field(min_length=1)
    mimeType: str = "image/png"
    role: GarmentRole
    label: str | None = None


class ExtractGarmentRequest(GarmentImageInput):
    maxLongEdge: int | None = Field(default=None, ge=64, le=4096)


class ExtractGarmentResponse(BaseModel):
    imageBase64: str
    mimeType: str = "image/png"
    width: int
    height: int
    role: GarmentRole
    method: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BoundingBox | None = None


class ComposeCollageItem(BaseModel):
    imageBase64: str = Field(min_length=1)
    mimeType: str = "image/png"
    role: GarmentRole
    label: str | None = None


class ComposeCollageRequest(BaseModel):
    items: list[ComposeCollageItem] = Field(min_length=1, max_length=6)
    layout: CollageLayout = "auto"
    width: int = Field(default=768, ge=256, le=4096)
    height: int = Field(default=768, ge=256, le=4096)
    backgroundColor: str = "#ffffff"


class ComposeCollageResponse(BaseModel):
    imageBase64: str
    mimeType: str = "image/png"
    width: int
    height: int
    layout: CollageLayout
    placements: list[BoundingBox]


class PrepareCollageRequest(BaseModel):
    items: list[GarmentImageInput] = Field(min_length=1, max_length=6)
    layout: CollageLayout = "auto"
    width: int = Field(default=768, ge=256, le=4096)
    height: int = Field(default=768, ge=256, le=4096)
    backgroundColor: str = "#ffffff"
    maxLongEdge: int | None = Field(default=None, ge=64, le=4096)


class PrepareCollageResponse(ComposeCollageResponse):
    extractedItems: list[ExtractGarmentResponse]
