import {
  getImageValidationReasonMessage,
  isImageValidationReasonCode,
  type ImageValidationInput,
  type ImageValidationBodyRegion,
  type ImageValidationCapability,
  type ImageValidationCapabilityMode,
  type ImageValidationProvider,
  type ImageValidationProviderName,
  type ImageValidationQuality,
  type ImageValidationReasonCode,
  type ImageValidationResult,
  type ImageValidationSafetyFlag,
} from './image-validation.types';

const readNumberEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const getResolutionQuality = (input: ImageValidationInput): ImageValidationQuality['resolution'] => {
  const minWidth = readNumberEnv('IMAGE_VALIDATION_MIN_WIDTH', 400);
  const minHeight = readNumberEnv('IMAGE_VALIDATION_MIN_HEIGHT', 400);

  return input.width >= minWidth && input.height >= minHeight ? 'ok' : 'fail';
};

const baseQuality = (input: ImageValidationInput): ImageValidationQuality => ({
  blur: 'ok',
  brightness: 'ok',
  resolution: getResolutionQuality(input),
});

const getSafetyFlags = (reasonCode: ImageValidationReasonCode): ImageValidationSafetyFlag[] => {
  if (reasonCode !== 'IMAGE_POLICY_BLOCKED') return [];
  return ['explicit'];
};

const capabilityModes: readonly ImageValidationCapabilityMode[] = [
  'full_set',
  'top_bottom',
  'top',
  'bottom',
  'dress',
  'shoes',
  'outerwear',
  'accessory',
];

const capabilityRequiredRegions: Record<ImageValidationCapabilityMode, ImageValidationBodyRegion[]> = {
  full_set: ['upper', 'hips', 'legs'],
  top_bottom: ['upper', 'hips', 'legs'],
  top: ['upper'],
  bottom: ['hips', 'legs'],
  dress: ['upper', 'hips', 'legs'],
  shoes: ['legs', 'feet'],
  outerwear: ['upper'],
  accessory: ['upper'],
};

const buildMockCapabilities = (
  reasonCode: ImageValidationReasonCode | null,
): ImageValidationCapability[] =>
  capabilityModes.map((mode) => ({
    mode,
    allowed: reasonCode === null,
    reasonCode,
    message: reasonCode ? getImageValidationReasonMessage(reasonCode) : null,
    requiredRegions: capabilityRequiredRegions[mode],
    missingRegions: reasonCode === 'BODY_NOT_VISIBLE' ? capabilityRequiredRegions[mode] : [],
  }));

export const buildImageValidationResult = (
  input: ImageValidationInput,
  provider: ImageValidationProviderName,
  reasonCode: ImageValidationReasonCode | null,
): ImageValidationResult => {
  const effectiveReasonCode = reasonCode === 'MULTIPLE_PEOPLE_DETECTED' ? null : reasonCode;
  const quality = baseQuality(input);
  const allowed = effectiveReasonCode === null;

  if (effectiveReasonCode === 'IMAGE_TOO_BLURRY') quality.blur = 'fail';
  if (effectiveReasonCode === 'IMAGE_TOO_DARK') quality.brightness = 'fail';
  if (effectiveReasonCode === 'IMAGE_TOO_SMALL') quality.resolution = 'fail';
  const capabilities = buildMockCapabilities(effectiveReasonCode);
  const supportedModes = capabilities.filter((capability) => capability.allowed).map((capability) => capability.mode);

  return {
    allowed,
    reasonCode: effectiveReasonCode,
    message: effectiveReasonCode ? getImageValidationReasonMessage(effectiveReasonCode) : null,
    provider,
    personCount: reasonCode === 'NO_PERSON_DETECTED' ? 0 : reasonCode === 'MULTIPLE_PEOPLE_DETECTED' ? 2 : 1,
    mainPersonScore: reasonCode === 'NO_PERSON_DETECTED' ? 0.12 : 0.94,
    mainPersonBox: reasonCode === 'NO_PERSON_DETECTED'
      ? null
      : {
          x: reasonCode === 'PERSON_TOO_SMALL' ? 0.42 : 0.21,
          y: reasonCode === 'PERSON_TOO_SMALL' ? 0.28 : 0.08,
          width: reasonCode === 'PERSON_TOO_SMALL' ? 0.16 : 0.58,
          height: reasonCode === 'PERSON_TOO_SMALL' ? 0.26 : 0.86,
        },
    bodyVisibility: reasonCode === 'BODY_NOT_VISIBLE' ? 'partial' : allowed ? 'unknown' : 'good',
    poseConfidence: reasonCode === 'POSE_NOT_SUPPORTED' ? 0.22 : 0.88,
    quality,
    safetyFlags: effectiveReasonCode ? getSafetyFlags(effectiveReasonCode) : [],
    visibleRegions: allowed ? ['upper', 'hips', 'legs', 'feet'] : [],
    supportedModes,
    blockedModes: capabilities.reduce<ImageValidationResult['blockedModes']>((blockedModes, capability) => {
      if (!capability.allowed) {
        blockedModes[capability.mode] = {
          reasonCode: capability.reasonCode,
          message: capability.message,
          missingRegions: capability.missingRegions,
        };
      }
      return blockedModes;
    }, {}),
    recommendedMode: supportedModes[0] ?? null,
    capabilities,
  };
};

const getMockReasonCode = () => {
  const configured = process.env.IMAGE_VALIDATION_MOCK_REASON_CODE?.trim();
  return isImageValidationReasonCode(configured) ? configured : null;
};

export const createDisabledImageValidationProvider = (): ImageValidationProvider => ({
  name: 'disabled',
  async validate(input) {
    return buildImageValidationResult(input, 'disabled', null);
  },
});

export const createMockImageValidationProvider = (): ImageValidationProvider => ({
  name: 'mock',
  async validate(input) {
    const mockReasonCode = getMockReasonCode();
    if (mockReasonCode === 'VALIDATION_PROVIDER_FAILED') {
      throw new Error('Mock image validation provider failure');
    }
    if (mockReasonCode) {
      return buildImageValidationResult(input, 'mock', mockReasonCode);
    }
    if (getResolutionQuality(input) === 'fail') {
      return buildImageValidationResult(input, 'mock', 'IMAGE_TOO_SMALL');
    }

    return buildImageValidationResult(input, 'mock', null);
  },
});
