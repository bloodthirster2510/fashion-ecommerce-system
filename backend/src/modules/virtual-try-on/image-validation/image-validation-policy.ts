import {
  getImageValidationReasonMessage,
  type ImageValidationReasonCode,
  type ImageValidationResult,
} from './image-validation.types';

const sourceBlockingReasonCodes = new Set<ImageValidationReasonCode>([
  'NO_PERSON_DETECTED',
  'VALIDATION_PROVIDER_FAILED',
]);

const softGuidanceReasonCodes = new Set<ImageValidationReasonCode>([
  'PERSON_TOO_SMALL',
  'POSE_NOT_SUPPORTED',
  'IMAGE_TOO_BLURRY',
  'IMAGE_TOO_DARK',
  'IMAGE_TOO_SMALL',
]);

export const isImageValidationSourceBlockReason = (reasonCode: ImageValidationReasonCode) =>
  sourceBlockingReasonCodes.has(reasonCode);

export const isImageValidationSoftGuidanceReason = (reasonCode: ImageValidationReasonCode) =>
  softGuidanceReasonCodes.has(reasonCode);

const rejectImageValidationResult = (
  result: ImageValidationResult,
  reasonCode: ImageValidationReasonCode,
): ImageValidationResult => ({
  ...result,
  allowed: false,
  reasonCode,
  message: getImageValidationReasonMessage(reasonCode),
});

export const applyImageValidationBasePolicy = (
  result: ImageValidationResult,
  personScoreThreshold: number,
): ImageValidationResult => {
  if (!result.allowed) return result;
  if (result.safetyFlags.length > 0) return rejectImageValidationResult(result, 'IMAGE_POLICY_BLOCKED');
  if (result.quality.resolution === 'fail') return rejectImageValidationResult(result, 'IMAGE_TOO_SMALL');
  if (result.quality.blur === 'fail') return rejectImageValidationResult(result, 'IMAGE_TOO_BLURRY');
  if (result.quality.brightness === 'fail') return rejectImageValidationResult(result, 'IMAGE_TOO_DARK');
  if (result.personCount < 1 || result.mainPersonScore < personScoreThreshold) {
    return rejectImageValidationResult(result, 'NO_PERSON_DETECTED');
  }
  if (result.bodyVisibility === 'partial') return rejectImageValidationResult(result, 'BODY_NOT_VISIBLE');

  return result;
};
