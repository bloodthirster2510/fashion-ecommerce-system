const hardBlockingReasonCodes = new Set([
  'NO_PERSON_DETECTED',
  'IMAGE_POLICY_BLOCKED',
]);

export const isImageValidationHardBlockReason = (reasonCode?: string | null) =>
  Boolean(reasonCode && hardBlockingReasonCodes.has(reasonCode));
