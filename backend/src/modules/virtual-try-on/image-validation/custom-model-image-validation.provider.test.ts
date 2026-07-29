import axios from 'axios';
import { createCustomModelImageValidationProvider } from './custom-model-image-validation.provider';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const input = {
  imageBuffer: Buffer.from('image'),
  mimeType: 'image/jpeg',
  width: 800,
  height: 1200,
  bytes: 5,
  source: 'upload' as const,
};

describe('custom model image validation provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not silently use a localhost endpoint when the URL is missing', async () => {
    await expect(createCustomModelImageValidationProvider().validate(input))
      .rejects.toThrow('IMAGE_VALIDATION_CUSTOM_MODEL_URL is required');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejects non-http custom model URLs', async () => {
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'file:///tmp/validate-image';

    await expect(createCustomModelImageValidationProvider().validate(input))
      .rejects.toThrow('must use HTTP or HTTPS');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
