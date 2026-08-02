const hardBlockingReasonCodes = new Set([
  'NO_PERSON_DETECTED',
]);

export const isImageValidationHardBlockReason = (reasonCode?: string | null) =>
  Boolean(reasonCode && hardBlockingReasonCodes.has(reasonCode));
