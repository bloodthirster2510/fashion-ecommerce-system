import type { VirtualTryOnProviderBinaryOutput } from './virtual-try-on-provider';

export type VirtualTryOnVideoProviderInput = {
  jobId: string;
  userId: string;
  sourceImageUrl: string;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  resolution: string;
  generateAudio: boolean;
};

export type VirtualTryOnVideoSubmission = {
  providerJobId: string;
  metadata?: Record<string, unknown>;
};

export type VirtualTryOnVideoProviderResult = {
  video?: VirtualTryOnProviderBinaryOutput;
  videoUrl?: string;
  metadata?: Record<string, unknown>;
};

export interface VirtualTryOnVideoProvider {
  submit(input: VirtualTryOnVideoProviderInput): Promise<VirtualTryOnVideoSubmission>;
  waitForResult(providerJobId: string): Promise<VirtualTryOnVideoProviderResult>;
}

export class VirtualTryOnVideoProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
    public readonly errorCode = 'VIDEO_PROVIDER_FAILED',
  ) {
    super(message);
    this.name = 'VirtualTryOnVideoProviderError';
  }
}
