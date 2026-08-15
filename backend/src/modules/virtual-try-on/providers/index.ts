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

export const getVirtualTryOnImageConfiguration = (override?: { provider?: string }) => {
  const provider = override?.provider?.trim()
    || process.env.VIRTUAL_TRY_ON_PROVIDER?.trim()
    || 'mock';
  const normalizedProvider = normalizeProviderName(provider);
  const issues: string[] = [];

  if (normalizedProvider === 'disabled') {
    issues.push('VIRTUAL_TRY_ON_DISABLED');
  } else if (normalizedProvider === 'mock') {
    // The mock provider is self-contained and needs no external configuration.
  } else if (['fashionshop-tryon', 'comfy', 'comfyui'].includes(normalizedProvider)) {
    if (!configuredFileExists(process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_PATH)) {
      issues.push('COMFY_WORKFLOW_MISSING');
    }
    if (!configuredFileExists(process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_MAP_PATH)) {
      issues.push('COMFY_WORKFLOW_MAP_MISSING');
    }
    if (!(process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL || process.env.VIRTUAL_TRY_ON_SERVICE_URL)) {
      issues.push('COMFY_BASE_URL_MISSING');
    }
  } else {
    issues.push('PROVIDER_NOT_CONFIGURED');
  }

  return {
    provider,
    ready: issues.length === 0,
    issues,
  };
};

const VIDEO_DURATION_MIN_SECONDS = 5;
const VIDEO_DURATION_MAX_SECONDS = 12;
const VIDEO_DURATION_DEFAULT_SECONDS = 5;

export const getVirtualTryOnVideoConfiguration = (override?: {
  provider?: string;
  model?: string;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
}) => {
  const provider = override?.provider?.trim()
    || process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER?.trim()
    || 'comfy_kling';
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

  const configuredDurationSeconds = override?.durationSeconds
    ?? Number(process.env.VIRTUAL_TRY_ON_VIDEO_DURATION_SECONDS);
  const durationSeconds = Number.isFinite(configuredDurationSeconds)
    ? Math.min(
        VIDEO_DURATION_MAX_SECONDS,
        Math.max(VIDEO_DURATION_MIN_SECONDS, Math.round(configuredDurationSeconds)),
      )
    : VIDEO_DURATION_DEFAULT_SECONDS;
  return {
    provider,
    ready: issues.length === 0,
    issues,
    model: override?.model?.trim()
      || process.env.VIRTUAL_TRY_ON_VIDEO_MODEL?.trim()
      || 'kling-v3-omni',
    durationSeconds,
    minDurationSeconds: VIDEO_DURATION_MIN_SECONDS,
    maxDurationSeconds: VIDEO_DURATION_MAX_SECONDS,
    resolution: override?.resolution?.trim()
      || process.env.VIRTUAL_TRY_ON_VIDEO_RESOLUTION?.trim()
      || '720p',
    aspectRatio: override?.aspectRatio?.trim()
      || process.env.VIRTUAL_TRY_ON_VIDEO_ASPECT_RATIO?.trim()
      || '9:16',
    generateAudio: override?.generateAudio
      ?? process.env.VIRTUAL_TRY_ON_VIDEO_GENERATE_AUDIO === 'true',
  };
};
