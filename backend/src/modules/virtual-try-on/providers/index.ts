import { existsSync } from 'fs';
import path from 'path';
import { createComfyVirtualTryOnProvider } from './comfy-virtual-try-on.provider';
import { createComfyVirtualTryOnVideoProvider } from './comfy-virtual-try-on-video.provider';
import { createMockVirtualTryOnProvider } from './mock-virtual-try-on.provider';
import { createMockVirtualTryOnVideoProvider } from './mock-virtual-try-on-video.provider';
import type { VirtualTryOnProvider } from './virtual-try-on-provider';
import { VirtualTryOnProviderError } from './virtual-try-on-provider';
import type { VirtualTryOnVideoProvider } from './virtual-try-on-video-provider';
import { VirtualTryOnVideoProviderError } from './virtual-try-on-video-provider';

export {
  buildVirtualTryOnVideoPrompt,
  buildVirtualTryOnPrompt,
  contextPresetPreviews,
  type VirtualTryOnContextPresetPreview,
} from './virtual-try-on-prompt';
export type {
  VirtualTryOnProvider,
  VirtualTryOnProviderBinaryOutput,
  VirtualTryOnProviderGarment,
  VirtualTryOnProviderInput,
  VirtualTryOnProviderResult,
  VirtualTryOnSourceImageProfile,
} from './virtual-try-on-provider';
export { VirtualTryOnProviderError } from './virtual-try-on-provider';
export type {
  VirtualTryOnVideoProvider,
  VirtualTryOnVideoProviderInput,
  VirtualTryOnVideoProviderResult,
  VirtualTryOnVideoSubmission,
} from './virtual-try-on-video-provider';
export { VirtualTryOnVideoProviderError } from './virtual-try-on-video-provider';

const normalizeProviderName = (providerName: string) =>
  providerName.trim().replace(/^\/+/, '');

export const createVirtualTryOnProvider = (providerName: string): VirtualTryOnProvider => {
  switch (normalizeProviderName(providerName)) {
    case 'mock':
      return createMockVirtualTryOnProvider();
    case 'fashionshop-tryon':
    case 'comfy':
    case 'comfyui':
      return createComfyVirtualTryOnProvider();
    case 'disabled':
      throw new VirtualTryOnProviderError(
        'Tính năng phối đồ ảo đang tắt',
        503,
        'VIRTUAL_TRY_ON_DISABLED',
      );
    default:
      throw new VirtualTryOnProviderError(
        `Provider ${providerName} chưa được tích hợp cho phối đồ ảo`,
        502,
        'PROVIDER_NOT_CONFIGURED',
      );
  }
};

export const createVirtualTryOnVideoProvider = (providerName: string): VirtualTryOnVideoProvider => {
  switch (normalizeProviderName(providerName)) {
    case 'mock':
      return createMockVirtualTryOnVideoProvider();
    case 'comfy-kling':
    case 'comfy_kling':
    case 'kling':
      return createComfyVirtualTryOnVideoProvider();
    case 'disabled':
      throw new VirtualTryOnVideoProviderError(
        'Tính năng sinh video đang tắt',
        503,
        'VIDEO_GENERATION_DISABLED',
      );
    default:
      throw new VirtualTryOnVideoProviderError(
        `Provider ${providerName} chưa được tích hợp cho sinh video`,
        500,
        'VIDEO_PROVIDER_NOT_CONFIGURED',
      );
  }
};

const configuredFileExists = (filePath?: string) => Boolean(
  filePath?.trim() && existsSync(path.resolve(filePath.trim())),
);

export const getVirtualTryOnVideoConfiguration = () => {
  const provider = process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER?.trim() || 'comfy_kling';
  const normalizedProvider = normalizeProviderName(provider);
  const issues: string[] = [];

  if (normalizedProvider === 'disabled') {
    issues.push('VIDEO_PROVIDER_DISABLED');
  } else if (normalizedProvider === 'mock') {
    if (!process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL?.trim()) {
      issues.push('VIDEO_MOCK_OUTPUT_MISSING');
    }
  } else if (['comfy-kling', 'comfy_kling', 'kling'].includes(normalizedProvider)) {
    if (!configuredFileExists(process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH)) {
      issues.push('VIDEO_WORKFLOW_MISSING');
    }
    if (!configuredFileExists(process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH)) {
      issues.push('VIDEO_WORKFLOW_MAP_MISSING');
    }
    if (!(process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL || process.env.VIRTUAL_TRY_ON_SERVICE_URL)) {
      issues.push('VIDEO_COMFY_BASE_URL_MISSING');
    }
  } else {
    issues.push('VIDEO_PROVIDER_NOT_CONFIGURED');
  }

  const durationSeconds = Math.max(1, Number(process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS) || 5);
  return {
    provider,
    ready: issues.length === 0,
    issues,
    model: process.env.VIRTUAL_TRY_ON_VIDEO_MODEL?.trim() || 'kling-v3-omni',
    durationSeconds,
    resolution: process.env.VIRTUAL_TRY_ON_VIDEO_RESOLUTION?.trim() || '720p',
    generateAudio: process.env.VIRTUAL_TRY_ON_VIDEO_GENERATE_AUDIO === 'true',
  };
};
