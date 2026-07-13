import axios from 'axios';
import { Types } from 'mongoose';
import {
  Product,
  VirtualTryOnAccountLock,
  VirtualTryOnAsset,
  VirtualTryOnJob,
  VirtualTryOnPromptRule,
  VirtualTryOnPromptViolation,
} from '../../../database/models';
import { deleteFromCloudinary, uploadToCloudinary } from '../../../utils/cloudinary.util';
import { virtualTryOnService } from '../virtual-try-on.service';
import { interactionService } from '../../interactions/interaction.service';

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
    create: jest.fn(),
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
  VirtualTryOnAccountLock: {
    findOne: jest.fn(),
  },
  VirtualTryOnPromptRule: {
    find: jest.fn(),
  },
}));

jest.mock('../../realtime/virtual-try-on.gateway', () => ({
  emitVirtualTryOnJobEvent: jest.fn(),
}));

jest.mock('../../interactions/interaction.service', () => ({
  interactionService: {
    recordInteractionBestEffort: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../../utils/cloudinary.util', () => ({
  deleteFromCloudinary: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedDeleteFromCloudinary = deleteFromCloudinary as jest.Mock;
const mockedProduct = Product as unknown as { find: jest.Mock };
const mockedUploadToCloudinary = uploadToCloudinary as jest.Mock;
const mockedVirtualTryOnAsset = VirtualTryOnAsset as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
};
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
const mockedVirtualTryOnAccountLock = VirtualTryOnAccountLock as unknown as {
  findOne: jest.Mock;
};
const mockedVirtualTryOnPromptRule = VirtualTryOnPromptRule as unknown as {
  find: jest.Mock;
};
const mockedInteractionService = interactionService as jest.Mocked<typeof interactionService>;

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

const uploadFile = {
  buffer: Buffer.from('source-image'),
  originalname: 'source.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
} as Express.Multer.File;

const uploadedSource = {
  secure_url: 'https://res.cloudinary.com/demo/image/upload/new-source.jpg',
  public_id: 'new-source',
  width: 1080,
  height: 1440,
  bytes: 1024,
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
  mockedVirtualTryOnAccountLock.findOne.mockResolvedValue(null);
  mockedVirtualTryOnPromptRule.find.mockReturnValue({
    sort: () => Promise.resolve([]),
  });
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
    mockedUploadToCloudinary.mockResolvedValue(uploadedSource);
    mockedDeleteFromCloudinary.mockResolvedValue(undefined);
    mockedVirtualTryOnAsset.create.mockResolvedValue({
      ...sourceAsset,
      _id: new Types.ObjectId('665000000000000000000111'),
      url: uploadedSource.secure_url,
      thumbnailUrl: uploadedSource.secure_url,
      publicId: uploadedSource.public_id,
      width: uploadedSource.width,
      height: uploadedSource.height,
      bytes: uploadedSource.bytes,
    });
    setupCreateJobMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('validates source image during upload before saving it to the asset library', async () => {
    const result = await virtualTryOnService.uploadAsset(userId, uploadFile, 'upload');

    expect(result.url).toBe(uploadedSource.secure_url);
    expect(mockedVirtualTryOnAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: new Types.ObjectId(userId),
      type: 'source_upload',
      url: uploadedSource.secure_url,
      source: 'upload',
      status: 'active',
    }));
    expect(mockedDeleteFromCloudinary).not.toHaveBeenCalled();
  });

  it('returns a warning instead of rejecting source image upload when local safety check flags it', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'IMAGE_POLICY_BLOCKED';

    const result = await virtualTryOnService.uploadAsset(userId, uploadFile, 'upload');

    expect(result).toEqual(expect.objectContaining({
      url: uploadedSource.secure_url,
      validationWarning: {
        reasonCode: 'IMAGE_POLICY_BLOCKED',
        message: expect.any(String),
      },
    }));
    expect(mockedVirtualTryOnAsset.create).toHaveBeenCalledTimes(1);
    expect(mockedVirtualTryOnAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      validationWarning: {
        reasonCode: 'IMAGE_POLICY_BLOCKED',
        message: expect.any(String),
      },
      validationCheckedAt: expect.any(Date),
    }));
    expect(mockedDeleteFromCloudinary).not.toHaveBeenCalled();
  });

  it('rejects createJob when local validation does not detect a person', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'NO_PERSON_DETECTED';

    await expect(virtualTryOnService.createJob(userId, createJobInput)).rejects.toMatchObject({
      statusCode: 422,
      errorCode: 'NO_PERSON_DETECTED',
    });

    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('creates createJob with a warning when local image safety policy flags the source image', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'IMAGE_POLICY_BLOCKED';

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
    expect(mockedProduct.find).toHaveBeenCalled();
    expect(mockedInteractionService.recordInteractionBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        productId: productId.toString(),
        variantId: variantId.toString(),
        colorVariantId: colorVariantId.toString(),
        size: 'M',
        actionType: 'try_on',
        source: 'virtual_try_on',
        metadata: expect.objectContaining({ virtualTryOnJobId: jobId.toString() }),
      }),
      'Failed to record virtual try-on interaction',
    );
    expect(console.warn).toHaveBeenCalledWith(
      'Virtual try-on source image validation warning:',
      expect.objectContaining({ reasonCode: 'IMAGE_POLICY_BLOCKED' }),
    );
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
      type: { $in: ['source_upload', 'source_camera'] },
      status: 'active',
    });
    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('rejects createJob when multiple selected items use the same try-on role', async () => {
    await expect(virtualTryOnService.createJob(userId, {
      ...createJobInput,
      outfitMode: 'full_set',
      selectedItems: [
        createJobInput.selectedItems[0],
        {
          ...createJobInput.selectedItems[0],
          productId: new Types.ObjectId().toString(),
          role: 'top',
        },
      ],
    })).rejects.toMatchObject({
      errorCode: 'DUPLICATE_ITEM_ROLE',
      statusCode: 400,
    });

    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('rejects createJob when the selected source asset is not an uploaded or camera image', async () => {
    mockedVirtualTryOnAsset.findOne.mockResolvedValue(null);

    await expect(virtualTryOnService.createJob(userId, createJobInput)).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(mockedVirtualTryOnAsset.findOne).toHaveBeenCalledWith({
      _id: sourceAssetId,
      userId: new Types.ObjectId(userId),
      type: { $in: ['source_upload', 'source_camera'] },
      status: 'active',
    });
    expect(mockedVirtualTryOnJob.create).not.toHaveBeenCalled();
    expect(mockedProduct.find).not.toHaveBeenCalled();
  });

  it('creates the job with a warning when the image validation provider throws', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'VALIDATION_PROVIDER_FAILED';

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      'Virtual try-on source image validation warning:',
      expect.objectContaining({ reasonCode: 'VALIDATION_PROVIDER_FAILED' }),
    );
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
        visibleRegions: ['upper', 'hips', 'legs'],
        supportedModes: ['top', 'bottom', 'outerwear', 'accessory'],
        recommendedMode: 'top',
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
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledWith(expect.objectContaining({
      providerMetadata: {
        sourceImageProfile: expect.objectContaining({
          visibleRegions: ['upper', 'hips', 'legs'],
          supportedModes: expect.arrayContaining(['top', 'bottom']),
          recommendedMode: 'full_set',
        }),
      },
    }));
  });

  it('returns body suitability in Builder validation without repeating upload safety warning', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';
    mockedAxios.post.mockResolvedValue({
      data: {
        allowed: true,
        personCount: 1,
        mainPersonScore: 0.94,
        bodyVisibility: 'partial',
        quality: { blur: 'ok', brightness: 'ok', resolution: 'ok' },
        safetyFlags: ['explicit'],
        visibleRegions: ['upper'],
        supportedModes: ['top', 'outerwear', 'accessory'],
        recommendedMode: 'top',
      },
    });

    const result = await virtualTryOnService.validateAsset(userId, sourceAssetId.toString(), {
      outfitMode: 'single',
      selectedItems: [{ role: 'bottom' }],
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('BODY_NOT_VISIBLE');
    expect(result.safetyFlags).toEqual([]);
    expect(result.supportedModes).toEqual(expect.arrayContaining(['top', 'outerwear', 'accessory']));
  });

  it('rejects createJob when the selected role is outside the image body suitability', async () => {
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

    await expect(virtualTryOnService.createJob(userId, {
      ...createJobInput,
      selectedItems: [{ ...createJobInput.selectedItems[0], role: 'shoes' }],
    })).rejects.toMatchObject({
      statusCode: 422,
      errorCode: 'BODY_NOT_VISIBLE',
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
