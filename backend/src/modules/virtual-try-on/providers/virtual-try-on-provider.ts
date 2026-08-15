import type {
  VirtualTryOnContextPreset,
  VirtualTryOnItemRole,
  VirtualTryOnOutfitMode,
  VirtualTryOnOutputMode,
} from '../../../database/models';

export type VirtualTryOnProviderGarment = {
  role: VirtualTryOnItemRole;
  productId: string;
  variantId: string;
  colorVariantId: string;
  imageUrl: string;
  name: string;
  color?: string;
  size?: string;
};

export type VirtualTryOnSourceImageProfile = {
  bodyVisibility?: 'good' | 'partial' | 'unknown';
  visibleRegions?: Array<'upper' | 'hips' | 'legs' | 'feet'>;
  supportedModes?: string[];
  recommendedMode?: string | null;
  reasonCode?: string | null;
};

export type VirtualTryOnProviderInput = {
  jobId: string;
  userId: string;
  sourceImageUrl: string;
  sourceImageProfile?: VirtualTryOnSourceImageProfile;
  outfitMode: VirtualTryOnOutfitMode;
  outputMode: VirtualTryOnOutputMode;
  garments: VirtualTryOnProviderGarment[];
  context: {
    preset: VirtualTryOnContextPreset;
    prompt?: string;
    preserveOriginalBackground: boolean;
  };
  prompt: string;
  negativePrompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  seed?: number;
  providerJobId?: string | null;
  onProviderJobSubmitted?: (
    providerJobId: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
};

export type VirtualTryOnProviderBinaryOutput = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type VirtualTryOnProviderResult = {
  imageUrl?: string;
  image?: VirtualTryOnProviderBinaryOutput;
  imageUrls?: string[];
  images?: VirtualTryOnProviderBinaryOutput[];
  videoUrl?: string | null;
  video?: VirtualTryOnProviderBinaryOutput | null;
  providerJobId?: string | null;
  metadata?: Record<string, unknown>;
};

export interface VirtualTryOnProvider {
  generate(input: VirtualTryOnProviderInput): Promise<VirtualTryOnProviderResult>;
}

export class VirtualTryOnProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
    public readonly errorCode = 'PROVIDER_FAILED',
  ) {
    super(message);
    this.name = 'VirtualTryOnProviderError';
  }
}
