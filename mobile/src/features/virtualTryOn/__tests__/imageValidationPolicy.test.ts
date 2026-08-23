import {
  isImageValidationHardBlockReason,
  isImageValidationSoftGuidanceReason,
  isImageValidationSourceBlockReason,
} from '../imageValidationPolicy';

describe('image validation policy', () => {
  it.each([
    'NO_PERSON_DETECTED',
    'VALIDATION_PROVIDER_FAILED',
  ])('blocks %s', (reasonCode) => {
    expect(isImageValidationSourceBlockReason(reasonCode)).toBe(true);
  });

  it.each([
    'PERSON_TOO_SMALL',
    'BODY_NOT_VISIBLE',
    'POSE_NOT_SUPPORTED',
    'IMAGE_TOO_BLURRY',
    'IMAGE_TOO_DARK',
    'IMAGE_TOO_SMALL',
    'IMAGE_POLICY_BLOCKED',
  ])('keeps %s as a warning', (reasonCode) => {
    expect(isImageValidationHardBlockReason(reasonCode)).toBe(false);
  });

  it('treats MULTIPLE_PEOPLE_DETECTED as ready', () => {
    expect(isImageValidationHardBlockReason('MULTIPLE_PEOPLE_DETECTED')).toBe(false);
    expect(isImageValidationSoftGuidanceReason('MULTIPLE_PEOPLE_DETECTED')).toBe(false);
  });

  it('does not block missing validation results', () => {
    expect(isImageValidationHardBlockReason(null)).toBe(false);
    expect(isImageValidationHardBlockReason(undefined)).toBe(false);
  });

  it.each([
    'PERSON_TOO_SMALL',
    'POSE_NOT_SUPPORTED',
    'IMAGE_TOO_BLURRY',
    'IMAGE_TOO_DARK',
    'IMAGE_TOO_SMALL',
  ])('renders %s as soft guidance', (reasonCode) => {
    expect(isImageValidationSoftGuidanceReason(reasonCode)).toBe(true);
  });

  it.each([
    'NO_PERSON_DETECTED',
    'MULTIPLE_PEOPLE_DETECTED',
    'BODY_NOT_VISIBLE',
    'IMAGE_POLICY_BLOCKED',
    'VALIDATION_PROVIDER_FAILED',
    null,
  ])('does not render %s as soft guidance', (reasonCode) => {
    expect(isImageValidationSoftGuidanceReason(reasonCode)).toBe(false);
  });
});
