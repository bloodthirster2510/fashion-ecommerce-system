import type {
  VirtualTryOnContextPreset,
  VirtualTryOnItemRole,
  VirtualTryOnOutfitMode,
  VirtualTryOnOutputMode,
} from '../../database/models';

export type UploadAssetSource = 'upload' | 'camera';

export type CreateVirtualTryOnItemInput = {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size?: string;
  role: VirtualTryOnItemRole;
};

export type CreateVirtualTryOnJobInput = {
  sourceAssetId: string;
  outfitMode: VirtualTryOnOutfitMode;
  selectedItems: CreateVirtualTryOnItemInput[];
  contextPreset?: VirtualTryOnContextPreset;
  contextPrompt?: string;
  outputMode?: VirtualTryOnOutputMode;
};

export type ValidateVirtualTryOnAssetInput = {
  outfitMode: VirtualTryOnOutfitMode;
  selectedItems: Array<Pick<CreateVirtualTryOnItemInput, 'role'>>;
};

export type VirtualTryOnListQuery = {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
};

