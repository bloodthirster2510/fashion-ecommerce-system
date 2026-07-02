import { createCustomModelImageValidationProvider } from './custom-model-image-validation.provider';
import {
  createDisabledImageValidationProvider,
  createMockImageValidationProvider,
} from './mock-image-validation.provider';
import type { ImageValidationProvider, ImageValidationProviderName } from './image-validation.types';

export type {
  ImageValidationBodyVisibility,
  ImageValidationBoundingBox,
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

const providerNames: readonly ImageValidationProviderName[] = [
  'disabled',
  'mock',
  'cloud_vision',
  'local_pretrained',
  'custom_model',
];

export const getConfiguredImageValidationProviderName = (): ImageValidationProviderName => {
  const configured = process.env.IMAGE_VALIDATION_PROVIDER?.trim();
  return providerNames.includes(configured as ImageValidationProviderName)
    ? configured as ImageValidationProviderName
    : 'mock';
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
      return createMockImageValidationProvider();
  }
};
