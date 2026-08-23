const sourceBlockingReasonCodes = new Set([
  'NO_PERSON_DETECTED',
  'VALIDATION_PROVIDER_FAILED',
]);

const softGuidanceReasonCodes = new Set([
  'PERSON_TOO_SMALL',
  'POSE_NOT_SUPPORTED',
  'IMAGE_TOO_BLURRY',
  'IMAGE_TOO_DARK',
  'IMAGE_TOO_SMALL',
]);

export const isImageValidationSourceBlockReason = (reasonCode?: string | null) =>
  Boolean(reasonCode && sourceBlockingReasonCodes.has(reasonCode));

export const isImageValidationHardBlockReason = (reasonCode?: string | null) =>
  isImageValidationSourceBlockReason(reasonCode);

export const isImageValidationSoftGuidanceReason = (reasonCode?: string | null) =>
  Boolean(reasonCode && softGuidanceReasonCodes.has(reasonCode));
