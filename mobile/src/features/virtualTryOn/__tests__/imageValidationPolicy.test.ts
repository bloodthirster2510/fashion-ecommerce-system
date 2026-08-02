import { isImageValidationHardBlockReason } from '../imageValidationPolicy';

describe('image validation policy', () => {
  it.each([
    'NO_PERSON_DETECTED',
    'IMAGE_POLICY_BLOCKED',
  ])('blocks %s', (reasonCode) => {
    expect(isImageValidationHardBlockReason(reasonCode)).toBe(true);
  });

  it.each([
    'MULTIPLE_PEOPLE_DETECTED',
    'PERSON_TOO_SMALL',
    'BODY_NOT_VISIBLE',
    'POSE_NOT_SUPPORTED',
    'IMAGE_TOO_BLURRY',
    'IMAGE_TOO_DARK',
    'IMAGE_TOO_SMALL',
    'VALIDATION_PROVIDER_FAILED',
  ])('keeps %s as a warning', (reasonCode) => {
    expect(isImageValidationHardBlockReason(reasonCode)).toBe(false);
  });

  it('does not block missing validation results', () => {
    expect(isImageValidationHardBlockReason(null)).toBe(false);
    expect(isImageValidationHardBlockReason(undefined)).toBe(false);
  });
});
