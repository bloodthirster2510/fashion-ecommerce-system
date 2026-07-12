from typing import Literal

from pydantic import BaseModel, Field


OutfitMode = Literal["single", "top_bottom", "full_set"]
ItemRole = Literal["top", "bottom", "dress", "shoes", "accessory", "outerwear"]
BodyRegion = Literal["upper", "hips", "legs", "feet"]
CapabilityMode = Literal[
    "full_set",
    "top_bottom",
    "top",
    "bottom",
    "dress",
    "shoes",
    "outerwear",
    "accessory",
]
QualityLevel = Literal["ok", "warn", "fail"]
BodyVisibility = Literal["good", "partial", "unknown"]
ReasonCode = Literal[
    "NO_PERSON_DETECTED",
    "MULTIPLE_PEOPLE_DETECTED",
    "PERSON_TOO_SMALL",
    "BODY_NOT_VISIBLE",
    "POSE_NOT_SUPPORTED",
    "IMAGE_TOO_BLURRY",
    "IMAGE_TOO_DARK",
    "IMAGE_TOO_SMALL",
    "IMAGE_POLICY_BLOCKED",
    "VALIDATION_PROVIDER_FAILED",
]
SourceKind = Literal["upload", "camera"]


class ValidationRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    mimeType: str = "image/jpeg"
    width: int = Field(ge=0)
    height: int = Field(ge=0)
    bytes: int = Field(ge=0)
    source: SourceKind = "upload"
    outfitMode: OutfitMode | None = None
    itemRoles: list[ItemRole] = Field(default_factory=list)


class BoundingBox(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(ge=0.0, le=1.0)
    height: float = Field(ge=0.0, le=1.0)


class Quality(BaseModel):
    blur: QualityLevel = "ok"
    brightness: QualityLevel = "ok"
    resolution: QualityLevel = "ok"


class CapabilityBlock(BaseModel):
    reasonCode: ReasonCode | None = None
    message: str | None = None
    missingRegions: list[BodyRegion] = Field(default_factory=list)


class ImageCapability(BaseModel):
    mode: CapabilityMode
    allowed: bool
    reasonCode: ReasonCode | None = None
    message: str | None = None
    requiredRegions: list[BodyRegion] = Field(default_factory=list)
    missingRegions: list[BodyRegion] = Field(default_factory=list)


class ValidationResponse(BaseModel):
    allowed: bool
    reasonCode: ReasonCode | None = None
    message: str | None = None
    provider: str = "custom_model"
    personCount: int = Field(ge=0)
    mainPersonScore: float = Field(ge=0.0)
    mainPersonBox: BoundingBox | None = None
    bodyVisibility: BodyVisibility = "unknown"
    poseConfidence: float | None = None
    quality: Quality
    safetyFlags: list[str] = Field(default_factory=list)
    visibleRegions: list[BodyRegion] = Field(default_factory=list)
    supportedModes: list[CapabilityMode] = Field(default_factory=list)
    blockedModes: dict[CapabilityMode, CapabilityBlock] = Field(default_factory=dict)
    recommendedMode: CapabilityMode | None = None
    capabilities: list[ImageCapability] = Field(default_factory=list)
