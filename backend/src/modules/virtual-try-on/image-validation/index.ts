import axios from 'axios';
import { createCustomModelImageValidationProvider } from './custom-model-image-validation.provider';
import {
  createDisabledImageValidationProvider,
  createMockImageValidationProvider,
} from './mock-image-validation.provider';
import type { ImageValidationProvider, ImageValidationProviderName } from './image-validation.types';

export type {
  ImageValidationBodyRegion,
  ImageValidationBodyVisibility,
  ImageValidationBoundingBox,
  ImageValidationCapability,
  ImageValidationCapabilityBlock,
  ImageValidationCapabilityMode,
  ImageValidationInput,
  ImageValidationProvider,
  ImageValidationProviderName,
  ImageValidationQuality,
  ImageValidationQualityLevel,
  ImageValidationReasonCode,
  ImageValidationResult,
  ImageValidationSafetyFlag,
} from './image-validation.types';

export {
  getImageValidationReasonMessage,
  getImageValidationReasonStatus,
  IMAGE_VALIDATION_REASON_CODES,
  IMAGE_VALIDATION_REASON_MESSAGES,
  IMAGE_VALIDATION_REASON_STATUSES,
  isImageValidationReasonCode,
} from './image-validation.types';

export {
  applyImageValidationBasePolicy,
  isImageValidationSoftGuidanceReason,
  isImageValidationSourceBlockReason,
} from './image-validation-policy';

const providerNames: readonly ImageValidationProviderName[] = [
  'disabled',
  'mock',
  'cloud_vision',
  'local_pretrained',
  'custom_model',
];

export type ImageValidationProviderResolution = {
  requestedProvider: string;
  provider: ImageValidationProviderName;
  configured: boolean;
  fallback: boolean;
  failOpen: boolean;
};

export type ImageValidationProviderHealth = ImageValidationProviderResolution & {
  available: boolean;
  reasonCode: string | null;
  latencyMs: number | null;
  checkedAt: string;
};

const getCustomModelUrl = () => process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL?.trim() || null;

export const isImageValidationFailOpen = () =>
  process.env.NODE_ENV !== 'production' &&
  process.env.IMAGE_VALIDATION_FAIL_OPEN === 'true';

export const getImageValidationProviderResolution = (): ImageValidationProviderResolution => {
  const requestedProvider = process.env.IMAGE_VALIDATION_PROVIDER?.trim().toLowerCase() || 'auto';
  const customModelConfigured = Boolean(getCustomModelUrl());

  if (providerNames.includes(requestedProvider as ImageValidationProviderName)) {
    const provider = requestedProvider as ImageValidationProviderName;
    return {
      requestedProvider,
      provider,
      configured:
        provider === 'disabled' ||
        provider === 'mock' ||
        (provider === 'custom_model' && customModelConfigured),
      fallback: false,
      failOpen: isImageValidationFailOpen(),
    };
  }

  if (customModelConfigured) {
    return {
      requestedProvider,
      provider: 'custom_model',
      configured: true,
      fallback: false,
      failOpen: isImageValidationFailOpen(),
    };
  }

  const useMockFallback = process.env.NODE_ENV !== 'production';
  return {
    requestedProvider,
    provider: useMockFallback ? 'mock' : 'custom_model',
    configured: useMockFallback,
    fallback: useMockFallback,
    failOpen: isImageValidationFailOpen(),
  };
};

export const getConfiguredImageValidationProviderName = (): ImageValidationProviderName => {
  return getImageValidationProviderResolution().provider;
};

const getCustomModelHealthUrl = () => {
  const configuredHealthUrl = process.env.IMAGE_VALIDATION_CUSTOM_MODEL_HEALTH_URL?.trim();
  if (configuredHealthUrl) return configuredHealthUrl;

  const endpoint = getCustomModelUrl();
  if (!endpoint) return null;
  try {
    const healthUrl = new URL(endpoint);
    healthUrl.pathname = healthUrl.pathname.endsWith('/validate-image')
      ? `${healthUrl.pathname.slice(0, -'/validate-image'.length)}/health`
      : `${healthUrl.pathname.replace(/\/$/, '')}/health`;
    healthUrl.search = '';
    healthUrl.hash = '';
    return healthUrl.toString();
  } catch {
    return null;
  }
};

const getHealthTimeoutMs = () => {
  const timeoutMs = Number(process.env.IMAGE_VALIDATION_HEALTH_TIMEOUT_MS);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2_000;
};

export const checkImageValidationProviderHealth = async (): Promise<ImageValidationProviderHealth> => {
  const resolution = getImageValidationProviderResolution();
  const base = {
    ...resolution,
    checkedAt: new Date().toISOString(),
  };

  if (resolution.provider === 'disabled') {
    return {
      ...base,
      available: false,
      reasonCode: 'IMAGE_VALIDATION_DISABLED',
      latencyMs: null,
    };
  }
  if (resolution.provider === 'mock') {
    return {
      ...base,
      available: true,
      reasonCode: resolution.fallback ? 'USING_MOCK_FALLBACK' : null,
      latencyMs: 0,
    };
  }
  if (resolution.provider !== 'custom_model') {
    return {
      ...base,
      available: false,
      reasonCode: 'IMAGE_VALIDATION_PROVIDER_NOT_IMPLEMENTED',
      latencyMs: null,
    };
  }

  const healthUrl = getCustomModelHealthUrl();
  if (!resolution.configured || !healthUrl) {
    return {
      ...base,
      available: false,
      reasonCode: 'IMAGE_VALIDATION_URL_MISSING',
      latencyMs: null,
    };
  }

  const startedAt = Date.now();
  try {
    const response = await axios.get<{ status?: unknown }>(healthUrl, {
      timeout: getHealthTimeoutMs(),
    });
    const available = response.data?.status === 'ok';
    return {
      ...base,
      available,
      reasonCode: available ? null : 'IMAGE_VALIDATION_HEALTH_INVALID',
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      ...base,
      available: false,
      reasonCode: 'IMAGE_VALIDATION_UNREACHABLE',
      latencyMs: Date.now() - startedAt,
    };
  }
};

const createUnimplementedProvider = (name: ImageValidationProviderName): ImageValidationProvider => ({
  name,
  async validate() {
    throw new Error(`Image validation provider ${name} is not configured`);
  },
});

export const createImageValidationProvider = (
  providerName: ImageValidationProviderName = getConfiguredImageValidationProviderName(),
): ImageValidationProvider => {
  switch (providerName) {
    case 'disabled':
      return createDisabledImageValidationProvider();
    case 'mock':
      return createMockImageValidationProvider();
    case 'custom_model':
      return createCustomModelImageValidationProvider();
    case 'cloud_vision':
    case 'local_pretrained':
      return createUnimplementedProvider(providerName);
    default:
      return createCustomModelImageValidationProvider();
  }
};
