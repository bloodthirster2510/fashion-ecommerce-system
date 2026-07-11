import { getConfiguredImageValidationProviderName } from './index';

describe('image validation provider config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses the custom model by default so local uploads are not silently green-lit by mock validation', () => {
    process.env = { ...originalEnv };
    delete process.env.IMAGE_VALIDATION_PROVIDER;

    expect(getConfiguredImageValidationProviderName()).toBe('custom_model');
  });

  it('keeps mock validation only when explicitly configured', () => {
    process.env = {
      ...originalEnv,
      IMAGE_VALIDATION_PROVIDER: 'mock',
    };

    expect(getConfiguredImageValidationProviderName()).toBe('mock');
  });
});
