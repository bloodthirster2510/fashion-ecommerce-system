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
import {
  cleanupGeneratedAssetsBestEffort,
  persistGeneratedOutput,
  virtualTryOnService,
} from '../virtual-try-on.service';
import { virtualTryOnSettingsService } from '../virtual-try-on-settings.service';

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
    findOneAndUpdate: jest.fn(),
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

jest.mock('../../notifications/customer-notification.service', () => ({
  recordVirtualTryOnAccessNotification: jest.fn().mockResolvedValue(null),
  recordVirtualTryOnOutcomeNotification: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../notifications/push-notification.service', () => ({
  sendCustomerPush: jest.fn().mockResolvedValue({ sent: 0 }),
}));

jest.mock('../../../utils/cloudinary.util', () => ({
  deleteFromCloudinary: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));

jest.mock('../virtual-try-on-settings.service', () => ({
  virtualTryOnSettingsService: {
    getRuntimeSettings: jest.fn(),
    getSecretStatus: jest.fn(),
    rollbackSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedDeleteFromCloudinary = deleteFromCloudinary as jest.Mock;
const mockedProduct = Product as unknown as { find: jest.Mock };
const mockedUploadToCloudinary = uploadToCloudinary as jest.Mock;
const mockedVirtualTryOnAsset = VirtualTryOnAsset as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
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
const mockedSettingsService = virtualTryOnSettingsService as jest.Mocked<typeof virtualTryOnSettingsService>;

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
    mockedSettingsService.getRuntimeSettings.mockResolvedValue({
      enabled: true,
      imageProvider: 'mock',
      imageModel: 'mock',
      imageAspectRatio: '3:4',
      imageResolution: '2K',
      videoProvider: 'mock',
      videoModel: 'mock',
      videoDurationSeconds: 5,
      videoResolution: '720p',
      videoAspectRatio: '9:16',
      videoGenerateAudio: false,
      maxConcurrentJobsPerUser: 1,
      maxVideoJobsPerUserPerDay: 3,
      maxConcurrentVideoJobsPerUser: 1,
      promptMaxLength: 200,
      promptViolationLimitPerDay: 5,
      version: 0,
      persisted: false,
      updatedAt: null,
      historyVersions: [],
    });
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

  it('blocks new source uploads when the runtime feature switch is off', async () => {
    mockedSettingsService.getRuntimeSettings.mockResolvedValueOnce({
      enabled: false,
      imageProvider: 'mock',
      imageModel: 'mock',
      imageAspectRatio: '3:4',
      imageResolution: '2K',
      videoProvider: 'mock',
      videoModel: 'mock',
      videoDurationSeconds: 5,
      videoResolution: '720p',
      videoAspectRatio: '9:16',
      videoGenerateAudio: false,
      maxConcurrentJobsPerUser: 1,
      maxVideoJobsPerUserPerDay: 3,
      maxConcurrentVideoJobsPerUser: 1,
      promptMaxLength: 200,
      promptViolationLimitPerDay: 5,
      version: 4,
      persisted: true,
      updatedAt: now,
      historyVersions: [3],
    });

    await expect(virtualTryOnService.uploadAsset(userId, uploadFile, 'upload')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: 'VIRTUAL_TRY_ON_DISABLED',
    });
    expect(mockedUploadToCloudinary).not.toHaveBeenCalled();
  });

  it('reports validation health without blocking image generation', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';
    mockedAxios.get.mockRejectedValueOnce(new Error('connection refused'));

    const result = await virtualTryOnService.getCapabilities();

    expect(result.imageGeneration).toMatchObject({
      available: true,
    });
    expect(result.imageValidation).toMatchObject({
      provider: 'custom_model',
      available: false,
      failOpen: false,
      reasonCode: 'IMAGE_VALIDATION_UNREACHABLE',
    });
  });

  it('does not advertise image generation when the ComfyUI workflow is incomplete', async () => {
    mockedSettingsService.getRuntimeSettings.mockResolvedValueOnce({
      enabled: true,
      imageProvider: 'comfy',
      imageModel: 'gemini-test',
      imageAspectRatio: '3:4',
      imageResolution: '2K',
      videoProvider: 'disabled',
      videoModel: 'disabled',
      videoDurationSeconds: 5,
      videoResolution: '720p',
      videoAspectRatio: '9:16',
      videoGenerateAudio: false,
      maxConcurrentJobsPerUser: 1,
      maxVideoJobsPerUserPerDay: 3,
      maxConcurrentVideoJobsPerUser: 1,
      promptMaxLength: 200,
      promptViolationLimitPerDay: 5,
      version: 1,
      persisted: true,
      updatedAt: now,
      historyVersions: [],
    });
    process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_PATH = '';
    process.env.VIRTUAL_TRY_ON_COMFY_WORKFLOW_MAP_PATH = '';
    delete process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL;
    delete process.env.VIRTUAL_TRY_ON_SERVICE_URL;

    const result = await virtualTryOnService.getCapabilities();

    expect(result.imageGeneration).toEqual({
      available: false,
      provider: 'comfy',
      reasonCode: 'COMFY_WORKFLOW_MISSING',
    });
    expect(result.videoGeneration.available).toBe(false);
    expect(result.videoGeneration.reasonCode).toBe('COMFY_WORKFLOW_MISSING');
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

  it('rejects and cleans up source image upload when no person is detected', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'NO_PERSON_DETECTED';

    await expect(virtualTryOnService.uploadAsset(userId, uploadFile, 'upload')).rejects.toMatchObject({
      statusCode: 422,
      errorCode: 'NO_PERSON_DETECTED',
    });

    expect(mockedVirtualTryOnAsset.create).not.toHaveBeenCalled();
    expect(mockedDeleteFromCloudinary).toHaveBeenCalledWith(uploadedSource.public_id);
  });

  it('keeps source uploads usable with a warning when validation is unavailable', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'VALIDATION_PROVIDER_FAILED';

    const result = await virtualTryOnService.uploadAsset(userId, uploadFile, 'upload');

    expect(result.validationWarning).toMatchObject({
      reasonCode: 'VALIDATION_PROVIDER_FAILED',
    });
    expect(mockedVirtualTryOnAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      validationWarning: expect.objectContaining({
        reasonCode: 'VALIDATION_PROVIDER_FAILED',
      }),
    }));
    expect(mockedDeleteFromCloudinary).not.toHaveBeenCalled();
  });

  it('keeps source uploads usable with a warning when the safety heuristic flags them', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'IMAGE_POLICY_BLOCKED';

    const result = await virtualTryOnService.uploadAsset(userId, uploadFile, 'upload');

    expect(result.validationWarning).toMatchObject({
      reasonCode: 'IMAGE_POLICY_BLOCKED',
    });
    expect(mockedVirtualTryOnAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      validationWarning: expect.objectContaining({
        reasonCode: 'IMAGE_POLICY_BLOCKED',
      }),
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

  it.each([
    'MULTIPLE_PEOPLE_DETECTED',
    'PERSON_TOO_SMALL',
  ] as const)('creates the job with a warning for %s', async (reasonCode) => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = reasonCode;

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      'Virtual try-on source image validation warning:',
      expect.objectContaining({ reasonCode }),
    );
  });

  it('creates the job with a warning when the safety heuristic flags the source image', async () => {
    process.env.IMAGE_VALIDATION_MOCK_REASON_CODE = 'IMAGE_POLICY_BLOCKED';

    const result = await virtualTryOnService.createJob(userId, createJobInput);

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
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
      provider: 'mock',
      providerMetadata: expect.objectContaining({
        model: 'mock',
        settingsVersion: 0,
        sourceImageProfile: expect.objectContaining({
          visibleRegions: ['upper', 'hips', 'legs'],
          supportedModes: expect.arrayContaining(['top', 'bottom']),
          recommendedMode: 'full_set',
        }),
      }),
    }));
  });

  it('reports a safety warning during Builder validation without making it a submit blocker', async () => {
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
    expect(result.reasonCode).toBe('IMAGE_POLICY_BLOCKED');
    expect(result.safetyFlags).toEqual(['explicit']);
  });

  it('allows full-set creation with bottom and shoes when the lower body is visible', async () => {
    process.env.IMAGE_VALIDATION_PROVIDER = 'custom_model';
    process.env.IMAGE_VALIDATION_CUSTOM_MODEL_URL = 'http://127.0.0.1:7001/validate-image';
    mockedAxios.post.mockResolvedValue({
      data: {
        allowed: false,
        reasonCode: 'BODY_NOT_VISIBLE',
        message: 'Ảnh chưa đủ vùng cho full set',
        personCount: 1,
        mainPersonScore: 0.94,
        bodyVisibility: 'partial',
        quality: { blur: 'ok', brightness: 'ok', resolution: 'ok' },
        safetyFlags: [],
        visibleRegions: ['hips', 'legs', 'feet'],
        supportedModes: ['bottom', 'shoes'],
        blockedModes: {
          full_set: {
            reasonCode: 'BODY_NOT_VISIBLE',
            message: 'Ảnh chưa thấy rõ phần thân trên',
            missingRegions: ['upper'],
          },
        },
        recommendedMode: 'bottom',
        capabilities: [
          {
            mode: 'bottom',
            allowed: true,
            reasonCode: null,
            message: null,
            requiredRegions: ['hips', 'legs'],
            missingRegions: [],
          },
          {
            mode: 'shoes',
            allowed: true,
            reasonCode: null,
            message: null,
            requiredRegions: ['legs', 'feet'],
            missingRegions: [],
          },
          {
            mode: 'full_set',
            allowed: false,
            reasonCode: 'BODY_NOT_VISIBLE',
            message: 'Ảnh chưa thấy rõ phần thân trên',
            requiredRegions: ['upper', 'hips', 'legs'],
            missingRegions: ['upper'],
          },
        ],
      },
    });

    const result = await virtualTryOnService.createJob(userId, {
      ...createJobInput,
      outfitMode: 'full_set',
      selectedItems: [
        { ...createJobInput.selectedItems[0], role: 'bottom' },
        { ...createJobInput.selectedItems[0], role: 'shoes' },
      ],
    });

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledWith(expect.objectContaining({
      outfitMode: 'full_set',
      selectedItems: expect.arrayContaining([
        expect.objectContaining({ role: 'bottom' }),
        expect.objectContaining({ role: 'shoes' }),
      ]),
    }));
  });

  it('keeps provider safety failures terminal for user and admin job retries', async () => {
    const closedJob = {
      _id: jobId,
      status: 'failed',
      outputMode: 'image',
      errorCode: 'PROVIDER_SAFETY_BLOCKED',
    };
    mockedVirtualTryOnJob.findOne.mockResolvedValue(closedJob);

    await expect(virtualTryOnService.retryJob(userId, jobId.toString())).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'POLICY_VIOLATION_JOB_CLOSED',
    });
    await expect(virtualTryOnService.retryAdminJob(jobId.toString())).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'POLICY_VIOLATION_JOB_CLOSED',
    });
  });

  it('blocks user image and video retries while the account is feature-locked', async () => {
    mockedVirtualTryOnAccountLock.findOne.mockResolvedValue({
      reason: 'Tạm khóa để kiểm tra',
      lockedAt: now,
    });
    mockedVirtualTryOnJob.findOne.mockResolvedValue(null);

    await expect(virtualTryOnService.retryJob(userId, jobId.toString())).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'VIRTUAL_TRY_ON_FEATURE_LOCKED',
      data: {
        reason: 'Tạm khóa để kiểm tra',
        lockedAt: now.toISOString(),
      },
    });
    await expect(virtualTryOnService.retryVideo(userId, jobId.toString())).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'VIRTUAL_TRY_ON_FEATURE_LOCKED',
    });
    expect(mockedVirtualTryOnJob.findOne).not.toHaveBeenCalled();
  });

  it('keeps video safety failures terminal while preserving generated images', async () => {
    const closedVideoJob = {
      _id: jobId,
      status: 'succeeded',
      outputMode: 'image_and_video',
      generatedImageUrl: 'https://example.com/generated.png',
      generatedImageUrls: ['https://example.com/generated.png'],
      videoStatus: 'failed',
      videoErrorCode: 'VIDEO_PROVIDER_SAFETY_BLOCKED',
    };
    mockedVirtualTryOnJob.findOne.mockResolvedValue(closedVideoJob);

    await expect(virtualTryOnService.retryVideo(userId, jobId.toString())).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'POLICY_VIOLATION_JOB_CLOSED',
    });
    await expect(virtualTryOnService.retryAdminVideo(jobId.toString())).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'POLICY_VIOLATION_JOB_CLOSED',
    });
  });

  it('creates the job with a warning when the selected role is outside the image body suitability', async () => {
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

    const result = await virtualTryOnService.createJob(userId, {
      ...createJobInput,
      selectedItems: [{ ...createJobInput.selectedItems[0], role: 'shoes' }],
    });

    expect(result._id).toBe(jobId.toString());
    expect(mockedVirtualTryOnJob.create).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      'Virtual try-on source image validation warning:',
      expect.objectContaining({ reasonCode: 'BODY_NOT_VISIBLE' }),
    );
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

  it('removes a Cloudinary upload when creating its asset record fails', async () => {
    mockedUploadToCloudinary.mockResolvedValue({
      ...uploadedSource,
      public_id: 'generated-orphan',
      secure_url: 'https://example.com/generated.png',
    });
    mockedVirtualTryOnAsset.create.mockRejectedValue(new Error('database unavailable'));
    mockedDeleteFromCloudinary.mockResolvedValue(undefined);

    await expect(persistGeneratedOutput(
      { _id: jobId, userId: new Types.ObjectId(userId) } as never,
      'generated_image',
      { buffer: Buffer.from('generated'), mimeType: 'image/png', fileName: 'result.png' },
    )).rejects.toThrow('database unavailable');

    expect(mockedDeleteFromCloudinary).toHaveBeenCalledWith('generated-orphan', 'image');
  });

  it('marks an unattached generated asset deleted before removing its remote file', async () => {
    mockedVirtualTryOnAsset.findOneAndUpdate.mockResolvedValue({ _id: jobId });
    mockedDeleteFromCloudinary.mockResolvedValue(undefined);

    await cleanupGeneratedAssetsBestEffort([{
      assetId: jobId,
      publicId: 'generated-canceled-job',
      resourceType: 'image',
    }]);

    expect(mockedVirtualTryOnAsset.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: jobId, status: 'active' },
      { status: 'deleted', deletedAt: expect.any(Date) },
      { returnDocument: 'after' },
    );
    expect(mockedDeleteFromCloudinary).toHaveBeenCalledWith(
      'generated-canceled-job',
      'image',
    );
  });

  it('does not delete a remote file when another cleanup already claimed the asset', async () => {
    mockedVirtualTryOnAsset.findOneAndUpdate.mockResolvedValue(null);

    await cleanupGeneratedAssetsBestEffort([{
      assetId: jobId,
      publicId: 'already-cleaned',
      resourceType: 'image',
    }]);

    expect(mockedDeleteFromCloudinary).not.toHaveBeenCalled();
  });
});
