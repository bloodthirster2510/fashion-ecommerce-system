export type VirtualTryOnAsset = {
  _id: string;
  type: 'source_upload' | 'source_camera' | 'generated_image' | 'generated_video';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  bytes?: number;
  source: 'upload' | 'camera' | 'ai_provider';
  status: 'active' | 'deleted';
  createdAt: string;
  updatedAt: string;
};

export type TryOnItemRole = 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory' | 'outerwear';
export type TryOnOutfitMode = 'single' | 'top_bottom' | 'full_set';
export type TryOnContextPreset = 'none' | 'work' | 'casual' | 'party' | 'travel' | 'sport' | 'date' | 'custom';

export type TryOnSelectedItem = {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size?: string;
  role: TryOnItemRole;
  nameSnapshot: string;
  colorSnapshot?: string;
  imageSnapshot: string;
  priceSnapshot: number;
  finalPriceSnapshot: number;
};

export type TryOnImageValidationQualityLevel = 'ok' | 'warn' | 'fail';
export type TryOnImageValidationBodyRegion = 'upper' | 'hips' | 'legs' | 'feet';
export type TryOnImageValidationCapabilityMode =
  | 'full_set'
  | 'top_bottom'
  | 'top'
  | 'bottom'
  | 'dress'
  | 'shoes'
  | 'outerwear'
  | 'accessory';

export type TryOnImageValidationCapabilityBlock = {
  reasonCode: string | null;
  message: string | null;
  missingRegions: TryOnImageValidationBodyRegion[];
};

export type TryOnImageValidationCapability = TryOnImageValidationCapabilityBlock & {
  mode: TryOnImageValidationCapabilityMode;
  allowed: boolean;
  requiredRegions: TryOnImageValidationBodyRegion[];
};

export type TryOnImageValidationResult = {
  allowed: boolean;
  reasonCode: string | null;
  message: string | null;
  provider: string;
  personCount: number;
  mainPersonScore: number;
  bodyVisibility: 'good' | 'partial' | 'unknown';
  poseConfidence?: number;
  quality: {
    blur: TryOnImageValidationQualityLevel;
    brightness: TryOnImageValidationQualityLevel;
    resolution: TryOnImageValidationQualityLevel;
  };
  safetyFlags: string[];
  visibleRegions: TryOnImageValidationBodyRegion[];
  supportedModes: TryOnImageValidationCapabilityMode[];
  blockedModes: Partial<Record<TryOnImageValidationCapabilityMode, TryOnImageValidationCapabilityBlock>>;
  recommendedMode: TryOnImageValidationCapabilityMode | null;
  capabilities: TryOnImageValidationCapability[];
};

export type VirtualTryOnJob = {
  _id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  progress: number;
  sourceAsset: VirtualTryOnAsset | null;
  sourceImageUrl: string;
  selectedItems: TryOnSelectedItem[];
  outfitMode: TryOnOutfitMode;
  contextPreset: TryOnContextPreset;
  contextPrompt?: string;
  outputMode: 'image' | 'image_and_video';
  generatedImageUrl?: string | null;
  generatedImageUrls?: string[];
  generatedVideoUrl?: string | null;
  provider: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  totalFinalPrice: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

