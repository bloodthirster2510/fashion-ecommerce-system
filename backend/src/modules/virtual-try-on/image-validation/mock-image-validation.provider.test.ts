import { createImageValidationProvider } from '.';
import type { ImageValidationInput } from './image-validation.types';

const input: ImageValidationInput = {
  imageBuffer: Buffer.from('image'),
  mimeType: 'image/jpeg',
  width: 1080,
  height: 1440,
  bytes: 5,
  source: 'upload',
  outfitMode: 'full_set',
};

describe('mock image validation provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.IMAGE_VALIDATION_MOCK_REASON_CODE;
    delete process.env.IMAGE_VALIDATION_MIN_WIDTH;
    delete process.env.IMAGE_VALIDATION_MIN_HEIGHT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows a valid source image by default', async () => {
    const result = await createImageValidationProvider('mock').validate(input);

    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBeNull();
    expect(result.provider).toBe('mock');
  });

  it('can force a UI validation failure from env', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'NO_PERSON_DETECTED';

    const result = await createImageValidationProvider('mock').validate(input);

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('NO_PERSON_DETECTED');
    expect(result.personCount).toBe(0);
  });

  it('treats multiple people as a ready source image', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'MULTIPLE_PEOPLE_DETECTED';

    const result = await createImageValidationProvider('mock').validate(input);

    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBeNull();
    expect(result.personCount).toBe(2);
  });

  it('rejects images below the configured minimum resolution', async () => {
    process.env.IMAGE_VALIDATION_MIN_WIDTH = '1200';
    process.env.IMAGE_VALIDATION_MIN_HEIGHT = '1600';

    const result = await createImageValidationProvider('mock').validate(input);

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('IMAGE_TOO_SMALL');
    expect(result.quality.resolution).toBe('fail');
  });

  it('allows everything when image validation is disabled', async () => {
    const result = await createImageValidationProvider('disabled').validate({
      ...input,
      width: 1,
      height: 1,
    });

    expect(result.allowed).toBe(true);
    expect(result.provider).toBe('disabled');
  });
});
