import axios from 'axios';
import {
  checkImageValidationProviderHealth,
  getConfiguredImageValidationProviderName,
  getImageValidationProviderResolution,
  isImageValidationFailOpen,
} from './index';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('image validation provider config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
    };
    delete process.env.IMAGE_VALIDATION_PROVIDER;
    delete process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL;
    delete process.env.IMAGE_VALIDATION_CUSTOM_MODEL_HEALTH_URL;
    delete process.env.IMAGE_VALIDATION_FAIL_OPEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses mock fallback in development and test when auto has no custom URL', () => {
    expect(getConfiguredImageValidationProviderName()).toBe('mock');
    expect(getImageValidationProviderResolution()).toMatchObject({
      requestedProvider: 'auto',
      provider: 'mock',
      configured: true,
      fallback: true,
      failOpen: false,
    });
  });

  it('uses the custom model in auto mode when its URL is configured', () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'auto';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';

    expect(getImageValidationProviderResolution()).toMatchObject({
      provider: 'custom_model',
      configured: true,
      fallback: false,
    });
  });

  it('keeps production fail-closed when auto is missing the custom URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.IMAGE_VALIDATION_PROVIDER = 'auto';
    process.env.IMAGE_VALIDATION_FAIL_OPEN = 'true';

    expect(getImageValidationProviderResolution()).toMatchObject({
      provider: 'custom_model',
      configured: false,
      fallback: false,
      failOpen: false,
    });
    expect(isImageValidationFailOpen()).toBe(false);
  });

  it('keeps explicit mock validation without marking it as a fallback', () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'mock';

    expect(getImageValidationProviderResolution()).toMatchObject({
      provider: 'mock',
      configured: true,
      fallback: false,
    });
  });

  it('checks the derived custom model health endpoint', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ok' },
    } as never);

    const health = await checkImageValidationProviderHealth();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://127.0.0.1:7001/health',
      { timeout: 2_000 },
    );
    expect(health).toMatchObject({
      provider: 'custom_model',
      configured: true,
      available: true,
      reasonCode: null,
    });
  });

  it('reports a missing production URL without making a network request', async () => {
    process.env.NODE_ENV = 'production';
    process.env.IMAGE_VALIDATION_PROVIDER = 'auto';

    await expect(checkImageValidationProviderHealth()).resolves.toMatchObject({
      provider: 'custom_model',
      configured: false,
      available: false,
      reasonCode: 'IMAGE_VALIDATION_URL_MISSING',
      failOpen: false,
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('reports an unreachable custom model', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'https://validation.example.com/validate-image';
    mockedAxios.get.mockRejectedValue(new Error('connection refused'));

    await expect(checkImageValidationProviderHealth()).resolves.toMatchObject({
      available: false,
      reasonCode: 'IMAGE_VALIDATION_UNREACHABLE',
    });
  });
});
