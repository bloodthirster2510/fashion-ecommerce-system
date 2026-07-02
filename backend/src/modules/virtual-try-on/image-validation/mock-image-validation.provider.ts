import {
  getImageValidationReasonMessage,
  isImageValidationReasonCode,
  type ImageValidationInput,
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

export const buildImageValidationResult = (
  input: ImageValidationInput,
  provider: ImageValidationProviderName,
  reasonCode: ImageValidationReasonCode | null,
): ImageValidationResult => {
  const quality = baseQuality(input);
  const allowed = reasonCode === null;

  if (reasonCode === 'IMAGE_TOO_BLURRY') quality.blur = 'fail';
  if (reasonCode === 'IMAGE_TOO_DARK') quality.brightness = 'fail';
  if (reasonCode === 'IMAGE_TOO_SMALL') quality.resolution = 'fail';

  return {
    allowed,
    reasonCode,
    message: reasonCode ? getImageValidationReasonMessage(reasonCode) : null,
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
    safetyFlags: reasonCode ? getSafetyFlags(reasonCode) : [],
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
