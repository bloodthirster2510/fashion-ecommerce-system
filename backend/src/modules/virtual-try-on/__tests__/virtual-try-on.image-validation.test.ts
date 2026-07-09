import axios from 'axios';
import { Types } from 'mongoose';
import {
  Product,
  VirtualTryOnAsset,
  VirtualTryOnJob,
  VirtualTryOnPromptViolation,
} from '../../../database/models';
import { virtualTryOnService } from '../virtual-try-on.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../../../database/models', () => ({
  Product: {
    find: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
  VirtualTryOnAsset: {
    findOne: jest.fn(),
  },
  VirtualTryOnJob: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  VirtualTryOnPromptViolation: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock('../../realtime/virtual-try-on.gateway', () => ({
  emitVirtualTryOnJobEvent: jest.fn(),
}));

jest.mock('../../../utils/cloudinary.util', () => ({
  deleteFromCloudinary: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedProduct = Product as unknown as { find: jest.Mock };
const mockedVirtualTryOnAsset = VirtualTryOnAsset as unknown as { findOne: jest.Mock };
const mockedVirtualTryOnJob = VirtualTryOnJob as unknown as {
  countDocuments: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
};
const mockedVirtualTryOnPromptViolation = VirtualTryOnPromptViolation as unknown as {
  countDocuments: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
};

const userId = '665000000000000000000020';
const sourceAssetId = new Types.ObjectId('665000000000000000000101');
const productId = new Types.ObjectId('665000000000000000000201');
const variantId = new Types.ObjectId('665000000000000000000202');
const colorVariantId = new Types.ObjectId('665000000000000000000203');
const fitTypeId = new Types.ObjectId('665000000000000000000204');
const jobId = new Types.ObjectId('665000000000000000000301');
const now = new Date('2026-07-02T12:00:00.000Z');

const sourceAsset = {
  _id: sourceAssetId,
  userId: new Types.ObjectId(userId),
  type: 'source_upload',
  url: 'https://res.cloudinary.com/demo/image/upload/source.jpg',
  thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/source.jpg',
  publicId: 'source',
  mimeType: 'image/jpeg',
  width: 1080,
  height: 1440,
  bytes: 1024,
  source: 'upload',
  status: 'active',
  createdAt: now,
  updatedAt: now,
};

const product = {
  _id: productId,
  name: 'Basic Tee',
  product_image: 'https://example.com/product.jpg',
  variant: [
    {
      _id: variantId,
      fitTypeId,
      price: 200000,
      discount: 10,
      sizeMeasurements: [{ size: 'M', measurements: [{ key: 'chest', value: 50 }] }],
      colors: [
        {
          _id: colorVariantId,
          color: 'Black',
          image: 'https://example.com/black.jpg',
        },
      ],
      isActive: true,
    },
  ],
};

const createJobInput = {
  sourceAssetId: sourceAssetId.toString(),
  outfitMode: 'single' as const,
  selectedItems: [
    {
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      role: 'top' as const,
    },
  ],
  contextPreset: 'none' as const,
  outputMode: 'image' as const,
};

const setupCreateJobMocks = () => {
  mockedAxios.get.mockResolvedValue({
    data: Buffer.from('source-image'),
    headers: { 'content-type': 'image/jpeg' },
  });
  mockedVirtualTryOnPromptViolation.findOne.mockResolvedValue(null);
  mockedVirtualTryOnPromptViolation.countDocuments.mockResolvedValue(0);
  mockedVirtualTryOnPromptViolation.create.mockResolvedValue({});
  mockedVirtualTryOnAsset.findOne.mockResolvedValue(sourceAsset);
  mockedVirtualTryOnJob.countDocuments.mockResolvedValue(0);
  mockedProduct.find.mockResolvedValue([product]);
  mockedVirtualTryOnJob.create.mockImplementation(async (payload) => ({
    _id: jobId,
    ...payload,
    generatedImageUrl: null,
    generatedVideoUrl: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }));
};

describe('virtualTryOnService image validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      IMAGE_VALIDATION_PROVIDER: 'mock',
      IMAGE_VALIDATION_FAIL_OPEN: 'false',
      VIRTUAL_TRY_ON_MAX_CONCURRENT_JOBS_PER_USER: '1',
    };
    delete process.env.IMAGE_VALIDATION_MOCK_REASON_CODE;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setupCreateJobMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('rejects createJob with the provider validation reason', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'NO_PERSON_DETECTED';

    await expect(virtualTryOnService.createJob(userId, createJobInput)).rejects.toMatchObject({
      errorCode: 'NO_PERSON_DETECTED',
      statusCode: 422,
    });

    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('returns a pre-check image validation result without creating a job', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'NO_PERSON_DETECTED';

    const result = await virtualTryOnService.validateAsset(userId, sourceAssetId.toString(), {
      outfitMode: 'single',
      selectedItems: [{ role: 'top' }],
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('NO_PERSON_DETECTED');
    expect(mockedVirtualTryOnAsset.findOne).toHaveBeenCalledWith({
      _id: sourceAssetId,
      userId: new Types.ObjectId(userId),
      status: 'active',
    });
    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('fails closed when the image validation provider throws', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'VALIDATION_PROVIDER_FAILED';

    await expect(virtualTryOnService.createJob(userId, createJobInput)).rejects.toMatchObject({
      errorCode: 'VALIDATION_PROVIDER_FAILED',
      statusCode: 503,
    });

    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
  });

  it('creates the job when provider throws and fail-open is enabled', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'VALIDATION_PROVIDER_FAILED';
    process.env.IMAGE_VALIDATION_FAIL_OPEN = 'true';

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('Image validation failed open:', expect.any(Error));
  });

  it('skips image validation when provider is disabled', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'disabled';

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
  });

  it('sends selected item roles to the custom image validation provider', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';
    mockedAxios.post.mockResolvedValue({
      data: {
        allowed: true,
        personCount: 1,
        mainPersonScore: 0.94,
        bodyVisibility: 'good',
        quality: { blur: 'ok', brightness: 'ok', resolution: 'ok' },
        safetyFlags: [],
      },
    });

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://127.0.0.1:7001/validate-image',
      expect.objectContaining({
        outfitMode: 'single',
        itemRoles: ['top'],
      }),
      expect.any(Object),
    );
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
  });

  it('rejects createJob when the selected role is outside the image capabilities', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';
    mockedAxios.post.mockResolvedValue({
      data: {
        allowed: true,
        personCount: 1,
        mainPersonScore: 0.94,
        bodyVisibility: 'good',
        quality: { blur: 'ok', brightness: 'ok', resolution: 'ok' },
        safetyFlags: [],
        visibleRegions: ['upper', 'hips'],
        supportedModes: ['top', 'outerwear', 'accessory'],
        blockedModes: {
          shoes: {
            reasonCode: 'BODY_NOT_VISIBLE',
            message: 'Ảnh chưa thấy rõ vùng chân/bàn chân',
            missingRegions: ['feet', 'legs'],
          },
        },
        recommendedMode: 'top',
        capabilities: [
          {
            mode: 'top',
            allowed: true,
            reasonCode: null,
            message: null,
            requiredRegions: ['upper'],
            missingRegions: [],
          },
          {
            mode: 'shoes',
            allowed: false,
            reasonCode: 'BODY_NOT_VISIBLE',
            message: 'Ảnh chưa thấy rõ vùng chân/bàn chân',
            requiredRegions: ['legs', 'feet'],
            missingRegions: ['feet', 'legs'],
          },
        ],
      },
    });

    await expect(
      virtualTryOnService.createJob(userId, {
        ...createJobInput,
        selectedItems: [{ ...createJobInput.selectedItems[0], role: 'shoes' }],
      }),
    ).rejects.toMatchObject({
      errorCode: 'BODY_NOT_VISIBLE',
      statusCode: 422,
    });

    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('logs prompt policy violations before image validation or job creation', async () => {
    await expect(
      virtualTryOnService.createJob(userId, {
        ...createJobInput,
        contextPrompt: 'tạo ảnh khỏa thân',
      }),
    ).rejects.toMatchObject({
      errorCode: 'PROMPT_SEXUAL_CONTENT',
      statusCode: 400,
      data: expect.objectContaining({
        violationCount: 1,
        violationLimit: 5,
        remainingViolations: 4,
      }),
    });

    expect(mockedVirtualTryOnPromptViolation.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'warn',
      reasonCode: 'PROMPT_SEXUAL_CONTENT',
      violationCount: 1,
      blockedUntil: null,
    }));
    expect(mockedVirtualTryOnAsset.findOne).not.toHaveBeenCalled();
    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
  });

  it('temporarily blocks virtual try-on after the daily prompt violation limit', async () => {
    mockedVirtualTryOnPromptViolation.countDocuments.mockResolvedValue(4);

    await expect(
      virtualTryOnService.createJob(userId, {
        ...createJobInput,
        contextPrompt: 'tạo ảnh khỏa thân',
      }),
    ).rejects.toMatchObject({
      errorCode: 'PROMPT_POLICY_DAILY_LIMIT_REACHED',
      statusCode: 429,
      data: expect.objectContaining({
        violationCount: 5,
        violationLimit: 5,
        remainingViolations: 0,
      }),
    });

    expect(mockedVirtualTryOnPromptViolation.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'temporary_block',
      violationCount: 5,
      blockedUntil: expect.any(Date),
    }));
    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
  });

  it('rejects valid prompts while a prompt policy block is active', async () => {
    mockedVirtualTryOnPromptViolation.findOne.mockResolvedValue({
      violationCount: 5,
      blockedUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(
      virtualTryOnService.createJob(userId, {
        ...createJobInput,
        contextPrompt: 'quán cà phê ánh sáng tự nhiên',
      }),
    ).rejects.toMatchObject({
      errorCode: 'PROMPT_POLICY_TEMPORARY_BLOCKED',
      statusCode: 429,
    });

    expect(mockedVirtualTryOnPromptViolation.create).not.toHaveBeenCalled();
    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
  });
});
