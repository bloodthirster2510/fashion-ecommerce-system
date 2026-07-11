import axios from 'axios';
import { Types } from 'mongoose';
import {
  Product,
  User,
  VirtualTryOnAsset,
  VirtualTryOnJob,
  VirtualTryOnPromptViolation,
  type IColorVariant,
  type IProduct,
  type IProductVariant,
  type IVirtualTryOnAsset,
  type IVirtualTryOnJob,
  type VirtualTryOnAssetType,
  type VirtualTryOnContextPreset,
  type VirtualTryOnItemRole,
  type VirtualTryOnJobStatus,
  type VirtualTryOnOutfitMode,
  type VirtualTryOnOutputMode,
} from '../../database/models';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.util';
import { emitVirtualTryOnJobEvent } from '../realtime/virtual-try-on.gateway';
import {
  buildVirtualTryOnPrompt,
  createVirtualTryOnProvider,
  VirtualTryOnProviderError,
  type VirtualTryOnProviderBinaryOutput,
  type VirtualTryOnSourceImageProfile,
} from './providers';
import {
  createImageValidationProvider,
  getConfiguredImageValidationProviderName,
  getImageValidationReasonMessage,
  isImageValidationReasonCode,
  type ImageValidationBodyRegion,
  type ImageValidationCapability,
  type ImageValidationCapabilityMode,
  type ImageValidationInput,
  type ImageValidationReasonCode,
  type ImageValidationResult,
} from './image-validation';
import { PROMPT_MAX_LENGTH, validateVirtualTryOnPrompt } from './prompt-policy/prompt-policy.service';
import type {
  CreateVirtualTryOnItemInput,
  CreateVirtualTryOnJobInput,
  UploadAssetSource,
  ValidateVirtualTryOnAssetInput,
  VirtualTryOnListQuery,
} from './virtual-try-on.types';

export class VirtualTryOnServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'VirtualTryOnServiceError';
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_SELECTED_ITEMS = Number(process.env.VIRTUAL_TRY_ON_MAX_SELECTED_ITEMS || 4);
const PROVIDER = process.env.VIRTUAL_TRY_ON_PROVIDER?.trim() || 'mock';
const ENABLE_VIDEO = process.env.VIRTUAL_TRY_ON_ENABLE_VIDEO === 'true';
const IMAGE_VALIDATION_DOWNLOAD_TIMEOUT_MS = 15_000;
const DEFAULT_PROMPT_VIOLATION_LIMIT_PER_DAY = 5;
const jobBlockingImageValidationReasonCodes = new Set<ImageValidationReasonCode>([
  'NO_PERSON_DETECTED',
  'BODY_NOT_VISIBLE',
  'PERSON_TOO_SMALL',
]);

const allowedRoles = new Set<VirtualTryOnItemRole>([
  'top',
  'bottom',
  'dress',
  'shoes',
  'accessory',
  'outerwear',
]);
const roleDisplayLabels: Record<VirtualTryOnItemRole, string> = {
  top: 'áo chính',
  bottom: 'quần',
  dress: 'váy/đầm',
  shoes: 'giày/dép',
  accessory: 'phụ kiện',
  outerwear: 'áo khoác',
};
const allowedOutfitModes = new Set<VirtualTryOnOutfitMode>(['single', 'top_bottom', 'full_set']);
const allowedContextPresets = new Set<VirtualTryOnContextPreset>([
  'none',
  'work',
  'casual',
  'party',
  'travel',
  'sport',
  'date',
  'custom',
]);
const allowedOutputModes = new Set<VirtualTryOnOutputMode>(['image', 'image_and_video']);
const allowedStatuses = new Set<VirtualTryOnJobStatus>([
  'queued',
  'processing',
  'succeeded',
  'failed',
  'canceled',
]);

const getPromptViolationLimitPerDay = () => {
  const configuredLimit = Number(process.env.VIRTUAL_TRY_ON_PROMPT_VIOLATION_LIMIT_PER_DAY);
  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.floor(configuredLimit)
    : DEFAULT_PROMPT_VIOLATION_LIMIT_PER_DAY;
};

const getLocalDayRange = (value = new Date()) => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const formatPromptBlockUntil = (value: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);

const toObjectId = (id: string, field: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new VirtualTryOnServiceError(`Invalid ${field}`, 400);
  }
  return new Types.ObjectId(id);
};

const toIdString = (value: unknown) => {
  if (value instanceof Types.ObjectId) return value.toString();
  if (value && typeof value === 'object' && 'toString' in value) return value.toString();
  return String(value);
};

const clampPagination = (query: VirtualTryOnListQuery) => {
  const page = Math.max(Number(query.page) || DEFAULT_PAGE, DEFAULT_PAGE);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  return { page, limit };
};

const getFinalPrice = (price: number, discount: number) =>
  discount > 0 ? Math.round(price * (1 - discount / 100)) : price;

const getAssetType = (source: UploadAssetSource): VirtualTryOnAssetType =>
  source === 'camera' ? 'source_camera' : 'source_upload';

const sourceAssetTypes: VirtualTryOnAssetType[] = ['source_upload', 'source_camera'];
const virtualTryOnAssetTypes: VirtualTryOnAssetType[] = [
  ...sourceAssetTypes,
  'generated_image',
  'generated_video',
];

const isVirtualTryOnAssetType = (value: string): value is VirtualTryOnAssetType =>
  virtualTryOnAssetTypes.includes(value as VirtualTryOnAssetType);

const serializeAsset = (asset: IVirtualTryOnAsset) => ({
  _id: asset._id.toString(),
  type: asset.type,
  url: asset.url,
  thumbnailUrl: asset.thumbnailUrl,
  width: asset.width,
  height: asset.height,
  bytes: asset.bytes,
  source: asset.source,
  status: asset.status,
  validationWarning: asset.validationWarning
    ? {
        reasonCode: asset.validationWarning.reasonCode,
        message: asset.validationWarning.message,
      }
    : undefined,
  validationCheckedAt: asset.validationCheckedAt?.toISOString() ?? null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString(),
});

const getGeneratedImageUrls = (job: Pick<IVirtualTryOnJob, 'generatedImageUrl' | 'generatedImageUrls'>) => {
  if (job.generatedImageUrls?.length) return job.generatedImageUrls;
  return job.generatedImageUrl ? [job.generatedImageUrl] : [];
};

const serializeJob = async (job: IVirtualTryOnJob) => {
  const sourceAsset = await VirtualTryOnAsset.findOne({
    _id: job.sourceAssetId,
    userId: job.userId,
  });
  return {
    _id: job._id.toString(),
    status: job.status,
    progress: job.progress,
    sourceAsset: sourceAsset ? serializeAsset(sourceAsset) : null,
    sourceImageUrl: job.sourceImageUrlSnapshot,
    selectedItems: job.selectedItems.map((item) => ({
      productId: item.productId.toString(),
      variantId: item.variantId.toString(),
      colorVariantId: item.colorVariantId.toString(),
      size: item.size,
      role: item.role,
      nameSnapshot: item.nameSnapshot,
      colorSnapshot: item.colorSnapshot,
      imageSnapshot: item.imageSnapshot,
      priceSnapshot: item.priceSnapshot,
      finalPriceSnapshot: item.finalPriceSnapshot,
    })),
    outfitMode: job.outfitMode,
    contextPreset: job.contextPreset,
    contextPrompt: job.contextPrompt,
    outputMode: job.outputMode,
    generatedImageUrl: job.generatedImageUrl,
    generatedImageUrls: getGeneratedImageUrls(job),
    generatedVideoUrl: job.generatedVideoUrl,
    provider: job.provider,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    totalFinalPrice: job.selectedItems.reduce((sum, item) => sum + item.finalPriceSnapshot, 0),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
};

const emitJob = (job: IVirtualTryOnJob, type: 'queued' | 'processing' | 'progress' | 'succeeded' | 'failed' | 'canceled') => {
  emitVirtualTryOnJobEvent(job.userId.toString(), {
    type,
    jobId: job._id.toString(),
    status: job.status,
    progress: job.progress,
    generatedImageUrl: job.generatedImageUrl,
    generatedImageUrls: getGeneratedImageUrls(job),
    generatedVideoUrl: job.generatedVideoUrl,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
  });
};

const updateJobStatus = async (
  jobId: string,
  update: Partial<Pick<
    IVirtualTryOnJob,
    'status' | 'progress' | 'generatedImageAssetId' | 'generatedImageUrl' | 'generatedImageAssetIds' | 'generatedImageUrls' | 'generatedVideoAssetId' | 'generatedVideoUrl' | 'providerJobId' | 'errorCode' | 'errorMessage' | 'startedAt' | 'completedAt' | 'providerMetadata'
  >>,
  eventType: 'queued' | 'processing' | 'progress' | 'succeeded' | 'failed' | 'canceled',
) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    { _id: jobId, deletedAt: null, status: { $nin: ['canceled'] } },
    update,
    { new: true },
  );
  if (job) emitJob(job, eventType);
  return job;
};

type VirtualTryOnProviderResult = {
  generatedImageUrl: string;
  generatedImageAssetId?: Types.ObjectId | null;
  generatedImageUrls: string[];
  generatedImageAssetIds?: Types.ObjectId[];
  generatedVideoUrl?: string | null;
  generatedVideoAssetId?: Types.ObjectId | null;
  providerJobId?: string | null;
  providerMetadata?: Record<string, unknown>;
};

const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const getGeneratedFileName = (
  job: IVirtualTryOnJob,
  type: VirtualTryOnAssetType,
  output: VirtualTryOnProviderBinaryOutput,
  index?: number,
) => {
  const fallbackExtension = output.fileName.split('.').pop() || 'bin';
  const extension = mimeExtensions[output.mimeType] || fallbackExtension;
  const suffix = typeof index === 'number' ? `-${index}` : '';
  return `${job._id.toString()}-${type}${suffix}.${extension}`;
};

const persistGeneratedOutput = async (
  job: IVirtualTryOnJob,
  type: Extract<VirtualTryOnAssetType, 'generated_image' | 'generated_video'>,
  output: VirtualTryOnProviderBinaryOutput,
  index?: number,
) => {
  const uploaded = await uploadToCloudinary(
    output.buffer,
    getGeneratedFileName(job, type, output, index),
    `fashion-ecommerce/virtual-try-on/users/${job.userId.toString()}/generated`,
    output.mimeType.startsWith('video/') ? 'video' : 'image',
  );

  const asset = await VirtualTryOnAsset.create({
    userId: job.userId,
    type,
    url: uploaded.secure_url,
    thumbnailUrl: type === 'generated_image' ? uploaded.secure_url : undefined,
    publicId: uploaded.public_id,
    mimeType: output.mimeType,
    width: uploaded.width,
    height: uploaded.height,
    bytes: uploaded.bytes,
    source: 'ai_provider',
    status: 'active',
  });

  return {
    assetId: asset._id as Types.ObjectId,
    url: uploaded.secure_url,
  };
};

const buildProviderInput = (job: IVirtualTryOnJob) => {
  const sourceImageProfile = getJobSourceImageProfile(job);
  const garments = job.selectedItems.map((item) => ({
    role: item.role,
    productId: item.productId.toString(),
    variantId: item.variantId.toString(),
    colorVariantId: item.colorVariantId.toString(),
    imageUrl: item.imageSnapshot,
    name: item.nameSnapshot,
    color: item.colorSnapshot,
    size: item.size,
  }));
  const prompt = buildVirtualTryOnPrompt({
    garments,
    preset: job.contextPreset,
    outfitMode: job.outfitMode,
    customPrompt: job.contextPrompt,
    sourceImageProfile,
  });

  return {
    jobId: job._id.toString(),
    userId: job.userId.toString(),
    sourceImageUrl: job.sourceImageUrlSnapshot,
    sourceImageProfile,
    outfitMode: job.outfitMode,
    outputMode: job.outputMode,
    garments,
    context: {
      preset: job.contextPreset,
      prompt: job.contextPrompt,
      preserveOriginalBackground: job.contextPreset === 'none',
    },
    prompt: prompt.prompt,
    negativePrompt: prompt.negativePrompt,
  };
};

const generateVirtualTryOnResult = async (job: IVirtualTryOnJob): Promise<VirtualTryOnProviderResult> => {
  const provider = createVirtualTryOnProvider(PROVIDER);
  const providerResult = await provider.generate(buildProviderInput(job));

  const generatedImageUrls = providerResult.imageUrls?.length
    ? [...providerResult.imageUrls]
    : providerResult.imageUrl
      ? [providerResult.imageUrl]
      : [];
  const generatedImageAssetIds: Types.ObjectId[] = [];
  const imageOutputs = providerResult.images?.length
    ? providerResult.images
    : providerResult.image
      ? [providerResult.image]
      : [];

  for (const [index, imageOutput] of imageOutputs.entries()) {
    const persistedImage = await persistGeneratedOutput(job, 'generated_image', imageOutput, index + 1);
    generatedImageUrls.push(persistedImage.url);
    generatedImageAssetIds.push(persistedImage.assetId);
  }

  const generatedImageUrl = generatedImageUrls[0];
  const generatedImageAssetId = generatedImageAssetIds[0] ?? null;
  if (!generatedImageUrl) {
    throw new VirtualTryOnProviderError('Provider did not return a generated image', 502, 'PROVIDER_OUTPUT_MISSING');
  }

  let generatedVideoUrl = providerResult.videoUrl ?? null;
  let generatedVideoAssetId: Types.ObjectId | null = null;
  if (providerResult.video) {
    const persistedVideo = await persistGeneratedOutput(job, 'generated_video', providerResult.video);
    generatedVideoUrl = persistedVideo.url;
    generatedVideoAssetId = persistedVideo.assetId;
  }

  return {
    generatedImageUrl,
    generatedImageAssetId,
    generatedImageUrls,
    generatedImageAssetIds,
    generatedVideoUrl,
    generatedVideoAssetId,
    providerJobId: providerResult.providerJobId ?? null,
    providerMetadata: {
      ...(providerResult.metadata ?? {}),
      outputMode: job.outputMode,
      videoRequested: job.outputMode === 'image_and_video',
      videoReturned: Boolean(generatedVideoUrl),
      imageCount: generatedImageUrls.length,
    },
  };
};

const delay = (ms: number) => {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
};

const runProviderJob = async (jobId: string) => {
  try {
    await delay(350);
    let job = await updateJobStatus(
      jobId,
      { status: 'processing', progress: 25, startedAt: new Date() },
      'processing',
    );
    if (!job) return;

    await delay(900);
    job = await updateJobStatus(jobId, { status: 'processing', progress: 62 }, 'progress');
    if (!job) return;

    const providerResult = await generateVirtualTryOnResult(job);

    await delay(900);
    await updateJobStatus(
      jobId,
      {
        status: 'succeeded',
        progress: 100,
        generatedImageAssetId: providerResult.generatedImageAssetId ?? null,
        generatedImageUrl: providerResult.generatedImageUrl,
        generatedImageAssetIds: providerResult.generatedImageAssetIds ?? [],
        generatedImageUrls: providerResult.generatedImageUrls,
        generatedVideoAssetId: providerResult.generatedVideoAssetId ?? null,
        generatedVideoUrl: providerResult.generatedVideoUrl ?? null,
        providerJobId: providerResult.providerJobId ?? null,
        providerMetadata: providerResult.providerMetadata ?? {},
        completedAt: new Date(),
      },
      'succeeded',
    );
  } catch (error) {
    console.error('Virtual try-on provider worker failed:', error);
    const serviceError = error instanceof VirtualTryOnServiceError
      ? error
      : error instanceof VirtualTryOnProviderError
        ? new VirtualTryOnServiceError(error.message, error.statusCode, error.errorCode)
        : null;
    await updateJobStatus(
      jobId,
      {
        status: 'failed',
        progress: 100,
        errorCode: serviceError?.errorCode ?? 'UNKNOWN',
        errorMessage: serviceError?.message ?? 'Không thể tạo kết quả phối đồ lúc này.',
        completedAt: new Date(),
      },
      'failed',
    );
  }
};

const enqueueJob = (jobId: string) => {
  const timer = setTimeout(() => { void runProviderJob(jobId); }, 0);
  timer.unref?.();
};

const findAssetForUser = async (userId: string, assetId: string) => {
  const asset = await VirtualTryOnAsset.findOne({
    _id: toObjectId(assetId, 'asset id'),
    userId: toObjectId(userId, 'user id'),
    status: 'active',
  });

  if (!asset) {
    throw new VirtualTryOnServiceError('Ảnh không tồn tại hoặc không thuộc tài khoản của bạn', 404);
  }

  return asset;
};

const findSourceAssetForUser = async (userId: string, assetId: string) => {
  const asset = await VirtualTryOnAsset.findOne({
    _id: toObjectId(assetId, 'asset id'),
    userId: toObjectId(userId, 'user id'),
    type: { $in: sourceAssetTypes },
    status: 'active',
  });

  if (!asset) {
    throw new VirtualTryOnServiceError('Không tìm thấy ảnh người mặc', 404);
  }

  return asset;
};

const shouldFailOpenImageValidation = () => process.env.IMAGE_VALIDATION_FAIL_OPEN === 'true';

const getImageValidationSource = (asset: IVirtualTryOnAsset): ImageValidationInput['source'] =>
  asset.source === 'camera' ? 'camera' : 'upload';

const downloadImageValidationBuffer = async (asset: IVirtualTryOnAsset) => {
  const response = await axios.get<ArrayBuffer>(asset.url, {
    responseType: 'arraybuffer',
    timeout: IMAGE_VALIDATION_DOWNLOAD_TIMEOUT_MS,
  });

  const responseMimeType = String(response.headers['content-type'] || '').split(';')[0].trim();
  return {
    buffer: Buffer.from(response.data),
    mimeType: asset.mimeType || responseMimeType || 'image/jpeg',
  };
};

const getPersonScoreThreshold = () => {
  const threshold = Number(process.env.IMAGE_VALIDATION_PERSON_SCORE_THRESHOLD);
  return Number.isFinite(threshold) ? threshold : 0.5;
};

const imageValidationCapabilityModes: readonly ImageValidationCapabilityMode[] = [
  'full_set',
  'top_bottom',
  'top',
  'bottom',
  'dress',
  'shoes',
  'outerwear',
  'accessory',
];

const imageValidationCapabilityRequiredRegions: Record<ImageValidationCapabilityMode, ImageValidationBodyRegion[]> = {
  full_set: ['upper', 'hips', 'legs'],
  top_bottom: ['upper', 'hips', 'legs'],
  top: ['upper'],
  bottom: ['hips', 'legs'],
  dress: ['upper', 'hips', 'legs'],
  shoes: ['legs', 'feet'],
  outerwear: ['upper'],
  accessory: ['upper'],
};

const getSelectionCapabilityModes = (
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
): ImageValidationCapabilityMode[] => {
  if (outfitMode === 'full_set') {
    return itemRoles.includes('shoes') ? ['full_set', 'shoes'] : ['full_set'];
  }
  if (outfitMode === 'top_bottom') return ['top_bottom'];

  return Array.from(new Set(itemRoles.map((role) => role as ImageValidationCapabilityMode)));
};

const buildAllowedImageValidationCapabilities = (): ImageValidationCapability[] =>
  imageValidationCapabilityModes.map((mode) => ({
    mode,
    allowed: true,
    reasonCode: null,
    message: null,
    requiredRegions: imageValidationCapabilityRequiredRegions[mode],
    missingRegions: [],
  }));

const getBaseBodySuitabilityReason = (result: ImageValidationResult): ImageValidationReasonCode | null => {
  if (result.provider === 'disabled') return null;
  if (result.quality.resolution === 'fail') return 'IMAGE_TOO_SMALL';
  if (result.quality.blur === 'fail') return 'IMAGE_TOO_BLURRY';
  if (result.quality.brightness === 'fail') return 'IMAGE_TOO_DARK';
  if (result.personCount < 1 || result.mainPersonScore < getPersonScoreThreshold()) {
    return 'NO_PERSON_DETECTED';
  }
  if (result.personCount > 1) return 'MULTIPLE_PEOPLE_DETECTED';
  return null;
};

const buildBodySuitabilityCapabilities = (
  result: ImageValidationResult,
  baseReason: ImageValidationReasonCode | null,
): ImageValidationCapability[] => {
  const visibleRegions = new Set(result.visibleRegions);
  return imageValidationCapabilityModes.map((mode) => {
    const requiredRegions = imageValidationCapabilityRequiredRegions[mode];
    const missingRegions = baseReason
      ? []
      : requiredRegions.filter((region) => !visibleRegions.has(region));
    const reasonCode = baseReason || (missingRegions.length ? 'BODY_NOT_VISIBLE' : null);
    return {
      mode,
      allowed: !reasonCode,
      reasonCode,
      message: reasonCode ? getImageValidationReasonMessage(reasonCode) : null,
      requiredRegions,
      missingRegions,
    };
  });
};

const buildBodySuitabilityResult = (
  result: ImageValidationResult,
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
): ImageValidationResult => {
  if (
    result.provider === 'disabled' ||
    result.message === 'Image validation is disabled' ||
    result.message === 'Image validation failed open'
  ) {
    return result;
  }

  const hasBodyRegionData =
    result.visibleRegions.length > 0 ||
    result.capabilities.some((capability) => (
      capability.allowed ||
      capability.reasonCode === 'BODY_NOT_VISIBLE' ||
      capability.missingRegions.length > 0
    )) ||
    result.supportedModes.length > 0 ||
    Object.values(result.blockedModes).some((block) => (
      block?.reasonCode === 'BODY_NOT_VISIBLE' ||
      Boolean(block?.missingRegions?.length)
    ));

  if (!hasBodyRegionData) {
    return applySelectionCapabilityPolicy({
      ...result,
      allowed: result.reasonCode === 'IMAGE_POLICY_BLOCKED' ? true : result.allowed,
      reasonCode: result.reasonCode === 'IMAGE_POLICY_BLOCKED' ? null : result.reasonCode,
      message: result.reasonCode === 'IMAGE_POLICY_BLOCKED' ? null : result.message,
      safetyFlags: [],
    }, outfitMode, itemRoles);
  }

  const baseReason = getBaseBodySuitabilityReason(result);
  const capabilities = buildBodySuitabilityCapabilities(result, baseReason);
  const supportedModes = capabilities.filter((capability) => capability.allowed).map((capability) => capability.mode);
  const blockedModes = capabilities.reduce<ImageValidationResult['blockedModes']>((acc, capability) => {
    if (!capability.allowed) {
      acc[capability.mode] = {
        reasonCode: capability.reasonCode,
        message: capability.message,
        missingRegions: capability.missingRegions,
      };
    }
    return acc;
  }, {});
  const selectedUnsupported = getSelectionCapabilityModes(outfitMode, itemRoles)
    .map((mode) => capabilities.find((capability) => capability.mode === mode))
    .find((capability): capability is ImageValidationCapability => Boolean(capability && !capability.allowed));
  const reasonCode = selectedUnsupported?.reasonCode ?? baseReason;

  return {
    ...result,
    allowed: !reasonCode,
    reasonCode,
    message: reasonCode
      ? selectedUnsupported?.message || getImageValidationReasonMessage(reasonCode)
      : null,
    safetyFlags: [],
    supportedModes,
    blockedModes,
    recommendedMode: supportedModes[0] ?? null,
    capabilities,
  };
};

const getUnsupportedSelectionCapability = (
  result: ImageValidationResult,
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
) => {
  if (!result.capabilities.length && !result.supportedModes.length && !Object.keys(result.blockedModes).length) {
    return null;
  }

  const capabilityByMode = new Map(result.capabilities.map((capability) => [capability.mode, capability]));
  return getSelectionCapabilityModes(outfitMode, itemRoles)
    .map((mode) => capabilityByMode.get(mode) ?? {
      mode,
      allowed: result.supportedModes.includes(mode),
      reasonCode: result.blockedModes[mode]?.reasonCode ?? 'BODY_NOT_VISIBLE',
      message: result.blockedModes[mode]?.message ?? getImageValidationReasonMessage('BODY_NOT_VISIBLE'),
      requiredRegions: imageValidationCapabilityRequiredRegions[mode],
      missingRegions: result.blockedModes[mode]?.missingRegions ?? [],
    })
    .find((capability) => !capability.allowed) ?? null;
};

const rejectImageValidationResult = (
  result: ImageValidationResult,
  reasonCode: ImageValidationReasonCode,
): ImageValidationResult => ({
  ...result,
  allowed: false,
  reasonCode,
  message: getImageValidationReasonMessage(reasonCode),
});

const applyImageValidationPolicy = (result: ImageValidationResult): ImageValidationResult => {
  if (!result.allowed) return result;
  if (result.safetyFlags.length > 0) return rejectImageValidationResult(result, 'IMAGE_POLICY_BLOCKED');
  if (result.quality.resolution === 'fail') return rejectImageValidationResult(result, 'IMAGE_TOO_SMALL');
  if (result.quality.blur === 'fail') return rejectImageValidationResult(result, 'IMAGE_TOO_BLURRY');
  if (result.quality.brightness === 'fail') return rejectImageValidationResult(result, 'IMAGE_TOO_DARK');
  if (result.personCount < 1 || result.mainPersonScore < getPersonScoreThreshold()) {
    return rejectImageValidationResult(result, 'NO_PERSON_DETECTED');
  }
  if (result.personCount > 1) return rejectImageValidationResult(result, 'MULTIPLE_PEOPLE_DETECTED');
  if (result.bodyVisibility === 'partial') return rejectImageValidationResult(result, 'BODY_NOT_VISIBLE');

  return result;
};

const applySelectionCapabilityPolicy = (
  result: ImageValidationResult,
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
): ImageValidationResult => {
  if (!result.allowed) return result;

  const unsupportedCapability = getUnsupportedSelectionCapability(result, outfitMode, itemRoles);
  if (!unsupportedCapability) return result;

  const reasonCode = unsupportedCapability.reasonCode || 'BODY_NOT_VISIBLE';
  return {
    ...rejectImageValidationResult(result, reasonCode as ImageValidationReasonCode),
    message: unsupportedCapability.message || getImageValidationReasonMessage(reasonCode),
  };
};

const getImageValidationWarning = (
  result: Pick<ImageValidationResult, 'allowed' | 'reasonCode' | 'message'>,
): { reasonCode: ImageValidationReasonCode; message: string } | null => {
  if (result.allowed) return null;

  const reasonCode: ImageValidationReasonCode = isImageValidationReasonCode(result.reasonCode)
    ? result.reasonCode
    : 'NO_PERSON_DETECTED';
  return {
    reasonCode,
    message: result.message || getImageValidationReasonMessage(reasonCode),
  };
};

const buildSourceImageProfile = (result: ImageValidationResult): VirtualTryOnSourceImageProfile => ({
  bodyVisibility: result.bodyVisibility,
  visibleRegions: result.visibleRegions,
  supportedModes: result.supportedModes,
  recommendedMode: result.recommendedMode,
  reasonCode: result.reasonCode,
});

const isSourceImageProfile = (value: unknown): value is VirtualTryOnSourceImageProfile => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.visibleRegions === undefined ||
    Array.isArray(candidate.visibleRegions)
  );
};

const getJobSourceImageProfile = (job: IVirtualTryOnJob): VirtualTryOnSourceImageProfile | undefined => {
  const profile = job.providerMetadata?.sourceImageProfile;
  return isSourceImageProfile(profile) ? profile : undefined;
};

const createImageValidationFallbackResult = (
  provider: ImageValidationResult['provider'],
  overrides: Partial<ImageValidationResult> = {},
): ImageValidationResult => {
  const allowed = overrides.allowed ?? true;
  const reasonCode = overrides.reasonCode ?? null;
  const message = overrides.message ?? (reasonCode ? getImageValidationReasonMessage(reasonCode) : null);
  const capabilities = allowed
    ? buildAllowedImageValidationCapabilities()
    : imageValidationCapabilityModes.map((mode) => ({
        mode,
        allowed: false,
        reasonCode,
        message,
        requiredRegions: imageValidationCapabilityRequiredRegions[mode],
        missingRegions: [],
      }));
  const supportedModes = capabilities.filter((capability) => capability.allowed).map((capability) => capability.mode);

  return {
    allowed,
    reasonCode,
    message,
    provider,
    personCount: 0,
    mainPersonScore: 0,
    mainPersonBox: null,
    bodyVisibility: 'unknown',
    quality: {
      blur: 'warn',
      brightness: 'warn',
      resolution: 'warn',
    },
    safetyFlags: [],
    visibleRegions: [],
    supportedModes,
    blockedModes: capabilities.reduce<ImageValidationResult['blockedModes']>((blockedModes, capability) => {
      if (!capability.allowed) {
        blockedModes[capability.mode] = {
          reasonCode: capability.reasonCode,
          message: capability.message,
          missingRegions: capability.missingRegions,
        };
      }
      return blockedModes;
    }, {}),
    recommendedMode: supportedModes[0] ?? null,
    capabilities,
    ...overrides,
  };
};

const getImageValidationResultForInput = async (input: ImageValidationInput) => {
  const providerName = getConfiguredImageValidationProviderName();
  if (providerName === 'disabled') {
    return createImageValidationFallbackResult('disabled', {
      provider: 'disabled',
      message: 'Image validation is disabled',
    });
  }

  try {
    const provider = createImageValidationProvider(providerName);
    return applyImageValidationPolicy(await provider.validate(input));
  } catch (error) {
    if (shouldFailOpenImageValidation()) {
      console.warn('Image validation failed open:', error);
      return createImageValidationFallbackResult(providerName, {
        message: 'Image validation failed open',
      });
    }

    return createImageValidationFallbackResult(providerName, {
      allowed: false,
      reasonCode: 'VALIDATION_PROVIDER_FAILED',
      message: getImageValidationReasonMessage('VALIDATION_PROVIDER_FAILED'),
    });
  }
};

const getSourceImageValidationResult = async (
  sourceAsset: IVirtualTryOnAsset,
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
) => {
  if (getConfiguredImageValidationProviderName() === 'disabled') {
    return createImageValidationFallbackResult('disabled', {
      provider: 'disabled',
      message: 'Image validation is disabled',
    });
  }

  const { buffer, mimeType } = await downloadImageValidationBuffer(sourceAsset);
  const result = await getImageValidationResultForInput({
    imageBuffer: buffer,
    mimeType,
    width: sourceAsset.width ?? 0,
    height: sourceAsset.height ?? 0,
    bytes: sourceAsset.bytes ?? buffer.byteLength,
    source: getImageValidationSource(sourceAsset),
    outfitMode,
    itemRoles,
  });

  return applySelectionCapabilityPolicy(result, outfitMode, itemRoles);
};

const getSourceImageSuitabilityResult = async (
  sourceAsset: IVirtualTryOnAsset,
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
) => {
  const result = await getSourceImageValidationResult(sourceAsset, outfitMode, itemRoles);
  return buildBodySuitabilityResult(result, outfitMode, itemRoles);
};

const warnSourceImageForJob = async (
  sourceAsset: IVirtualTryOnAsset,
  outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
) => {
  const result = await getSourceImageValidationResult(sourceAsset, outfitMode, itemRoles);
  const suitabilityResult = buildBodySuitabilityResult(result, outfitMode, itemRoles);
  const suitabilityWarning = getImageValidationWarning(suitabilityResult);
  if (suitabilityWarning && jobBlockingImageValidationReasonCodes.has(suitabilityWarning.reasonCode)) {
    throw new VirtualTryOnServiceError(
      suitabilityWarning.message,
      422,
      suitabilityWarning.reasonCode,
      { reasonCode: suitabilityWarning.reasonCode, message: suitabilityWarning.message },
    );
  }

  const warning = getImageValidationWarning(result);

  if (warning) {
    if (jobBlockingImageValidationReasonCodes.has(warning.reasonCode)) {
      throw new VirtualTryOnServiceError(
        warning.message,
        422,
        warning.reasonCode,
        { reasonCode: warning.reasonCode, message: warning.message },
      );
    }

    console.warn('Virtual try-on source image validation warning:', {
      assetId: sourceAsset._id.toString(),
      reasonCode: warning.reasonCode,
      message: warning.message,
    });
    return suitabilityResult;
  }

  const unsupportedCapability = getUnsupportedSelectionCapability(result, outfitMode, itemRoles);
  if (unsupportedCapability) {
    const reasonCode = unsupportedCapability.reasonCode || 'BODY_NOT_VISIBLE';
    console.warn('Virtual try-on source image capability warning:', {
      assetId: sourceAsset._id.toString(),
      reasonCode,
      message: unsupportedCapability.message || getImageValidationReasonMessage(reasonCode),
    });
  }

  return suitabilityResult;
};

const getSelectedItemRolesForValidation = (items: Array<Pick<CreateVirtualTryOnItemInput, 'role'>>) => {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_SELECTED_ITEMS) {
    throw new VirtualTryOnServiceError(`Vui lòng chọn từ 1 đến ${MAX_SELECTED_ITEMS} sản phẩm`, 400);
  }

  const roles = items.map((item) => {
    if (!allowedRoles.has(item.role)) {
      throw new VirtualTryOnServiceError('Vai trò sản phẩm không hợp lệ', 400);
    }
    return item.role;
  });
  const duplicateRole = roles.find((role, index) => roles.indexOf(role) !== index);
  if (duplicateRole) {
    const label = roleDisplayLabels[duplicateRole];
    throw new VirtualTryOnServiceError(
      `Mỗi bản phối chỉ nhận 1 ${label}. Hãy tạo lần lượt nếu muốn thử nhiều ${label}.`,
      400,
      'DUPLICATE_ITEM_ROLE',
    );
  }

  return roles;
};

const resolveSelectedItem = (
  input: CreateVirtualTryOnItemInput,
  product: IProduct,
) => {
  if (!allowedRoles.has(input.role)) {
    throw new VirtualTryOnServiceError('Vai trò sản phẩm không hợp lệ', 400);
  }

  const variant = product.variant.find((item: IProductVariant) => toIdString(item._id) === input.variantId);
  if (!variant || !variant.isActive) {
    throw new VirtualTryOnServiceError('Biến thể sản phẩm không hợp lệ hoặc đã ngừng bán', 400);
  }

  const color = variant.colors.find((item: IColorVariant) => toIdString(item._id) === input.colorVariantId);
  if (!color) {
    throw new VirtualTryOnServiceError('Màu sản phẩm không hợp lệ', 400);
  }

  const normalizedSize = input.size?.trim();
  if (normalizedSize) {
    const hasSize = variant.sizeMeasurements.some(
      (sizeMeasurement) => sizeMeasurement.size.trim().toLowerCase() === normalizedSize.toLowerCase(),
    );
    if (!hasSize) {
      throw new VirtualTryOnServiceError('Size không hợp lệ với biến thể đã chọn', 400);
    }
  }

  return {
    productId: product._id,
    variantId: variant._id,
    colorVariantId: color._id,
    ...(normalizedSize ? { size: normalizedSize } : {}),
    role: input.role,
    nameSnapshot: product.name,
    colorSnapshot: color.color,
    imageSnapshot: color.image || product.product_image,
    priceSnapshot: variant.price,
    finalPriceSnapshot: getFinalPrice(variant.price, variant.discount),
  };
};

const resolveSelectedItems = async (items: CreateVirtualTryOnItemInput[]) => {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_SELECTED_ITEMS) {
    throw new VirtualTryOnServiceError(`Vui lòng chọn từ 1 đến ${MAX_SELECTED_ITEMS} sản phẩm`, 400);
  }

  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  productIds.forEach((id) => toObjectId(id, 'product id'));

  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  return items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) {
      throw new VirtualTryOnServiceError('Sản phẩm không tồn tại hoặc đã ngừng bán', 400);
    }
    return resolveSelectedItem(item, product);
  });
};

const getPromptPolicyData = (input: {
  violationCount: number;
  limit: number;
  blockedUntil?: Date | null;
}) => ({
  violationCount: input.violationCount,
  violationLimit: input.limit,
  remainingViolations: Math.max(input.limit - input.violationCount, 0),
  blockedUntil: input.blockedUntil?.toISOString() ?? null,
});

const throwActivePromptBlock = (violation: { violationCount?: number; blockedUntil?: Date | null }): never => {
  const limit = getPromptViolationLimitPerDay();
  const blockedUntil = violation.blockedUntil ?? getLocalDayRange().end;
  throw new VirtualTryOnServiceError(
    `Tính năng phối đồ ảo đang bị tạm khóa do nhập mô tả vi phạm nhiều lần. Bạn có thể thử lại sau ${formatPromptBlockUntil(blockedUntil)}.`,
    429,
    'PROMPT_POLICY_TEMPORARY_BLOCKED',
    getPromptPolicyData({
      violationCount: violation.violationCount ?? limit,
      limit,
      blockedUntil,
    }),
  );
};

const ensurePromptPolicyNotBlocked = async (userObjectId: Types.ObjectId, now = new Date()) => {
  const activeBlock = await VirtualTryOnPromptViolation.findOne({
    userId: userObjectId,
    action: 'temporary_block',
    blockedUntil: { $gt: now },
  });

  if (activeBlock) {
    throwActivePromptBlock(activeBlock);
  }
};

const normalizePromptForLog = (prompt?: string) => {
  const normalized = prompt?.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return (normalized || '(empty)').slice(0, 500);
};

const validatePromptForCreateJob = async (userObjectId: Types.ObjectId, prompt?: string) => {
  const now = new Date();
  await ensurePromptPolicyNotBlocked(userObjectId, now);

  const promptValidation = validateVirtualTryOnPrompt(prompt);
  if (promptValidation.allowed) return promptValidation;

  const limit = getPromptViolationLimitPerDay();
  const { start, end } = getLocalDayRange(now);
  const previousViolationCount = await VirtualTryOnPromptViolation.countDocuments({
    userId: userObjectId,
    createdAt: { $gte: start, $lt: end },
  });
  const violationCount = previousViolationCount + 1;
  const shouldBlock = violationCount >= limit;
  const blockedUntil = shouldBlock ? end : null;

  await VirtualTryOnPromptViolation.create({
    userId: userObjectId,
    prompt: normalizePromptForLog(prompt),
    reasonCode: promptValidation.reasonCode || 'PROMPT_INVALID',
    matchedCategory: promptValidation.matchedCategory,
    matchedRule: promptValidation.matchedRule,
    action: shouldBlock ? 'temporary_block' : 'warn',
    violationCount,
    blockedUntil,
  });

  const policyData = getPromptPolicyData({ violationCount, limit, blockedUntil });
  if (shouldBlock) {
    throw new VirtualTryOnServiceError(
      `Bạn đã nhập mô tả vi phạm ${violationCount} lần hôm nay. Tính năng phối đồ ảo bị tạm khóa đến ${formatPromptBlockUntil(blockedUntil!)}.`,
      429,
      'PROMPT_POLICY_DAILY_LIMIT_REACHED',
      policyData,
    );
  }

  throw new VirtualTryOnServiceError(
    `${promptValidation.message || 'Mô tả bối cảnh không hợp lệ'} Bạn còn ${policyData.remainingViolations} lần vi phạm hôm nay trước khi bị tạm khóa tính năng này.`,
    400,
    promptValidation.reasonCode || 'PROMPT_INVALID',
    policyData,
  );
};

const validateCreateJobInput = (input: CreateVirtualTryOnJobInput) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new VirtualTryOnServiceError('Request body must be an object', 400);
  }
  if (!allowedOutfitModes.has(input.outfitMode)) {
    throw new VirtualTryOnServiceError('Chế độ phối đồ không hợp lệ', 400);
  }
  const contextPreset = input.contextPreset ?? 'none';
  if (!allowedContextPresets.has(contextPreset)) {
    throw new VirtualTryOnServiceError('Bối cảnh không hợp lệ', 400);
  }
  const outputMode = input.outputMode ?? 'image';
  if (!allowedOutputModes.has(outputMode)) {
    throw new VirtualTryOnServiceError('Kiểu kết quả không hợp lệ', 400);
  }
  if (outputMode === 'image_and_video' && !ENABLE_VIDEO) {
    throw new VirtualTryOnServiceError('Tạo video chưa được bật', 400);
  }

  return {
    contextPreset,
    outputMode,
  };
};

const uploadAsset = async (userId: string, file: Express.Multer.File, source: UploadAssetSource) => {
  if (!file) {
    throw new VirtualTryOnServiceError('Ảnh là bắt buộc', 400);
  }

  const userObjectId = toObjectId(userId, 'user id');
  const uploaded = await uploadToCloudinary(
    file.buffer,
    file.originalname || 'try-on-source',
    `fashion-ecommerce/virtual-try-on/users/${userId}/source`,
  );

  try {
    const validationResult = await getImageValidationResultForInput({
      imageBuffer: file.buffer,
      mimeType: file.mimetype || 'image/jpeg',
      width: uploaded.width ?? 0,
      height: uploaded.height ?? 0,
      bytes: uploaded.bytes ?? file.size ?? file.buffer.byteLength,
      source,
    });
    const validationWarning = getImageValidationWarning(validationResult);

    const asset = await VirtualTryOnAsset.create({
      userId: userObjectId,
      type: getAssetType(source),
      url: uploaded.secure_url,
      thumbnailUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      mimeType: file.mimetype,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
      source,
      status: 'active',
      validationWarning,
      validationCheckedAt: new Date(),
    });

    return {
      ...serializeAsset(asset),
      ...(validationWarning ? { validationWarning } : {}),
    };
  } catch (error) {
    deleteFromCloudinary(uploaded.public_id).catch((cleanupError) => {
      console.warn('Virtual try-on rejected source image cleanup failed:', cleanupError);
    });
    throw error;
  }
};

const listAssets = async (userId: string, query: VirtualTryOnListQuery) => {
  const { page, limit } = clampPagination(query);
  const requestedType = typeof query.type === 'string' ? query.type.trim() : '';
  const filter: Record<string, unknown> = {
    userId: toObjectId(userId, 'user id'),
    status: 'active',
  };

  if (requestedType) {
    if (!isVirtualTryOnAssetType(requestedType)) {
      throw new VirtualTryOnServiceError('Loại ảnh không hợp lệ', 400);
    }
    filter.type = requestedType;
  } else {
    filter.type = { $in: sourceAssetTypes };
  }

  const [items, totalItems] = await Promise.all([
    VirtualTryOnAsset.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    VirtualTryOnAsset.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeAsset),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const deleteAsset = async (userId: string, assetId: string) => {
  const asset = await findAssetForUser(userId, assetId);
  asset.status = 'deleted';
  asset.deletedAt = new Date();
  await asset.save();

  deleteFromCloudinary(asset.publicId).catch((error) => {
    console.warn('Virtual try-on asset Cloudinary cleanup failed:', error);
  });

  return serializeAsset(asset);
};

const validateAsset = async (
  userId: string,
  assetId: string,
  input: ValidateVirtualTryOnAssetInput,
) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new VirtualTryOnServiceError('Request body must be an object', 400);
  }
  if (!allowedOutfitModes.has(input.outfitMode)) {
    throw new VirtualTryOnServiceError('Chế độ phối đồ không hợp lệ', 400);
  }

  const sourceAsset = await findSourceAssetForUser(userId, assetId);
  const itemRoles = getSelectedItemRolesForValidation(input.selectedItems);
  return getSourceImageSuitabilityResult(sourceAsset, input.outfitMode, itemRoles);
};

const getActiveJobCount = (userId: string) =>
  VirtualTryOnJob.countDocuments({
    userId: toObjectId(userId, 'user id'),
    deletedAt: null,
    status: { $in: ['queued', 'processing'] },
  });

const createJob = async (
  userId: string,
  input: CreateVirtualTryOnJobInput,
  idempotencyKey?: string,
) => {
  const normalized = validateCreateJobInput(input);
  const userObjectId = toObjectId(userId, 'user id');

  if (PROVIDER === 'disabled') {
    throw new VirtualTryOnServiceError('Tính năng phối đồ ảo đang tắt', 503, 'VIRTUAL_TRY_ON_DISABLED');
  }

  if (idempotencyKey) {
    const existing = await VirtualTryOnJob.findOne({
      userId: userObjectId,
      idempotencyKey,
      deletedAt: null,
    });
    if (existing) return serializeJob(existing);
  }

  const promptValidation = await validatePromptForCreateJob(userObjectId, input.contextPrompt);
  const activeJobCount = await getActiveJobCount(userId);
  const maxConcurrent = Number(process.env.VIRTUAL_TRY_ON_MAX_CONCURRENT_JOBS_PER_USER || 1);
  if (activeJobCount >= maxConcurrent) {
    throw new VirtualTryOnServiceError('Bạn đang có yêu cầu phối đồ khác đang xử lý', 409, 'ACTIVE_JOB_EXISTS');
  }

  const sourceAsset = await findSourceAssetForUser(userId, input.sourceAssetId);
  const itemRoles = getSelectedItemRolesForValidation(input.selectedItems);
  const sourceImageValidationResult = await warnSourceImageForJob(sourceAsset, input.outfitMode, itemRoles);

  const selectedItems = await resolveSelectedItems(input.selectedItems);

  const job = await VirtualTryOnJob.create({
    userId: userObjectId,
    sourceAssetId: sourceAsset._id,
    sourceImageUrlSnapshot: sourceAsset.url,
    selectedItems,
    outfitMode: input.outfitMode,
    contextPreset: normalized.contextPreset,
    contextPrompt: promptValidation.normalizedPrompt || undefined,
    outputMode: normalized.outputMode,
    status: 'queued',
    progress: 0,
    provider: PROVIDER,
    idempotencyKey: idempotencyKey || null,
    providerMetadata: {
      sourceImageProfile: buildSourceImageProfile(sourceImageValidationResult),
    },
  });

  emitJob(job, 'queued');
  enqueueJob(job._id.toString());

  return serializeJob(job);
};

const getJob = async (userId: string, jobId: string) => {
  const job = await VirtualTryOnJob.findOne({
    _id: toObjectId(jobId, 'job id'),
    userId: toObjectId(userId, 'user id'),
    deletedAt: null,
  });

  if (!job) {
    throw new VirtualTryOnServiceError('Yêu cầu phối đồ không tồn tại', 404);
  }

  return serializeJob(job);
};

const getLatestJob = async (userId: string) => {
  const job = await VirtualTryOnJob.findOne({
    userId: toObjectId(userId, 'user id'),
    deletedAt: null,
  }).sort({ createdAt: -1 });

  return job ? serializeJob(job) : null;
};

const listJobs = async (userId: string, query: VirtualTryOnListQuery) => {
  const { page, limit } = clampPagination(query);
  const status = typeof query.status === 'string' ? query.status : undefined;
  const filter: Record<string, unknown> = {
    userId: toObjectId(userId, 'user id'),
    deletedAt: null,
  };

  if (status) {
    if (!allowedStatuses.has(status as VirtualTryOnJobStatus)) {
      throw new VirtualTryOnServiceError('Trạng thái không hợp lệ', 400);
    }
    filter.status = status;
  }

  const [items, totalItems] = await Promise.all([
    VirtualTryOnJob.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    VirtualTryOnJob.countDocuments(filter),
  ]);

  return {
    items: await Promise.all(items.map(serializeJob)),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const retryJob = async (userId: string, jobId: string) => {
  const job = await VirtualTryOnJob.findOne({
    _id: toObjectId(jobId, 'job id'),
    userId: toObjectId(userId, 'user id'),
    deletedAt: null,
    status: { $in: ['failed', 'canceled'] },
  });

  if (!job) {
    throw new VirtualTryOnServiceError('Chỉ có thể thử lại yêu cầu đã lỗi hoặc đã hủy', 400);
  }

  job.status = 'queued';
  job.progress = 0;
  job.generatedImageAssetIds = [];
  job.generatedImageUrls = [];
  job.generatedImageUrl = null;
  job.generatedVideoUrl = null;
  job.errorCode = null;
  job.errorMessage = null;
  job.startedAt = null;
  job.completedAt = null;
  await job.save();

  emitJob(job, 'queued');
  enqueueJob(job._id.toString());

  return serializeJob(job);
};

const cancelJob = async (userId: string, jobId: string) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: toObjectId(jobId, 'job id'),
      userId: toObjectId(userId, 'user id'),
      deletedAt: null,
      status: { $in: ['queued', 'processing'] },
    },
    {
      status: 'canceled',
      progress: 100,
      completedAt: new Date(),
    },
    { new: true },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Không thể hủy yêu cầu này', 400);
  }

  emitJob(job, 'canceled');
  return serializeJob(job);
};

const deleteJob = async (userId: string, jobId: string) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: toObjectId(jobId, 'job id'),
      userId: toObjectId(userId, 'user id'),
      deletedAt: null,
    },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Yêu cầu phối đồ không tồn tại', 404);
  }

  return serializeJob(job);
};

type AdminJobListQuery = VirtualTryOnListQuery & {
  provider?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const serializeAdminJob = async (job: IVirtualTryOnJob) => {
  const user = await User.findById(job.userId)
    .select('_id name email')
    .lean<{ _id: Types.ObjectId; name?: string; email?: string } | null>();

  return {
    _id: job._id.toString(),
    user: user
      ? {
          _id: user._id.toString(),
          name: user.name ?? '',
          email: user.email ?? '',
        }
      : null,
    status: job.status,
    progress: job.progress,
    outfitMode: job.outfitMode,
    contextPreset: job.contextPreset,
    contextPrompt: job.contextPrompt,
    outputMode: job.outputMode,
    provider: job.provider,
    selectedItemCount: job.selectedItems.length,
    selectedItems: job.selectedItems.map((item) => ({
      productId: item.productId.toString(),
      nameSnapshot: item.nameSnapshot,
      role: item.role,
      colorSnapshot: item.colorSnapshot,
      imageSnapshot: item.imageSnapshot,
      finalPriceSnapshot: item.finalPriceSnapshot,
    })),
    generatedImageUrl: job.generatedImageUrl,
    generatedImageUrls: getGeneratedImageUrls(job),
    generatedVideoUrl: job.generatedVideoUrl,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    totalFinalPrice: job.selectedItems.reduce((sum, item) => sum + item.finalPriceSnapshot, 0),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    deletedAt: job.deletedAt?.toISOString() ?? null,
  };
};

const buildAdminJobFilter = async (query: AdminJobListQuery) => {
  const filter: Record<string, unknown> = {
    deletedAt: null,
  };

  if (query.status) {
    if (!allowedStatuses.has(query.status as VirtualTryOnJobStatus)) {
      throw new VirtualTryOnServiceError('Trạng thái không hợp lệ', 400);
    }
    filter.status = query.status;
  }

  if (query.provider?.trim()) {
    filter.provider = query.provider.trim();
  }

  const createdAt: Record<string, Date> = {};
  if (query.dateFrom) {
    const dateFrom = new Date(query.dateFrom);
    if (Number.isNaN(dateFrom.getTime())) throw new VirtualTryOnServiceError('dateFrom không hợp lệ', 400);
    createdAt.$gte = dateFrom;
  }
  if (query.dateTo) {
    const dateTo = new Date(query.dateTo);
    if (Number.isNaN(dateTo.getTime())) throw new VirtualTryOnServiceError('dateTo không hợp lệ', 400);
    createdAt.$lte = dateTo;
  }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  const keyword = query.keyword?.trim();
  if (keyword) {
    if (keyword.length > 100) throw new VirtualTryOnServiceError('keyword không được vượt quá 100 ký tự', 400);
    const keywordRegex = new RegExp(escapeRegex(keyword), 'i');
    const matchedUsers = await User.find({
      $or: [{ name: keywordRegex }, { email: keywordRegex }],
    }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    const keywordConditions: Record<string, unknown>[] = [
      { provider: keywordRegex },
      { errorCode: keywordRegex },
      { errorMessage: keywordRegex },
      { 'selectedItems.nameSnapshot': keywordRegex },
    ];

    if (Types.ObjectId.isValid(keyword)) {
      keywordConditions.push({ _id: new Types.ObjectId(keyword) });
    }
    if (matchedUsers.length) {
      keywordConditions.push({ userId: { $in: matchedUsers.map((user) => user._id) } });
    }

    filter.$or = keywordConditions;
  }

  return filter;
};

const listAdminJobs = async (query: AdminJobListQuery) => {
  const { page, limit } = clampPagination(query);
  const filter = await buildAdminJobFilter(query);

  const [items, totalItems] = await Promise.all([
    VirtualTryOnJob.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    VirtualTryOnJob.countDocuments(filter),
  ]);

  return {
    items: await Promise.all(items.map(serializeAdminJob)),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getAdminSummary = async () => {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const [
    total,
    today,
    queued,
    processing,
    succeeded,
    failed,
    canceled,
    promptViolationsToday,
    promptBlocksToday,
    latestFailedJobs,
  ] = await Promise.all([
    VirtualTryOnJob.countDocuments({ deletedAt: null }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, createdAt: { $gte: dayStart } }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'queued' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'processing' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'succeeded' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'failed' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'canceled' }),
    VirtualTryOnPromptViolation.countDocuments({ createdAt: { $gte: dayStart } }),
    VirtualTryOnPromptViolation.countDocuments({ action: 'temporary_block', createdAt: { $gte: dayStart } }),
    VirtualTryOnJob.find({ deletedAt: null, status: 'failed' }).sort({ updatedAt: -1 }).limit(5),
  ]);

  return {
    total,
    today,
    queued,
    processing,
    succeeded,
    failed,
    canceled,
    successRate: total ? Math.round((succeeded / total) * 100) : 0,
    provider: PROVIDER,
    videoEnabled: ENABLE_VIDEO,
    promptViolationsToday,
    promptBlocksToday,
    latestFailedJobs: await Promise.all(latestFailedJobs.map(serializeAdminJob)),
    generatedAt: now.toISOString(),
  };
};

const getAdminSettings = () => ({
  provider: PROVIDER,
  enabled: PROVIDER !== 'disabled',
  videoEnabled: ENABLE_VIDEO,
  maxSelectedItems: MAX_SELECTED_ITEMS,
  maxConcurrentJobsPerUser: Number(process.env.VIRTUAL_TRY_ON_MAX_CONCURRENT_JOBS_PER_USER || 1),
  sourceImageMaxMb: 5,
  promptMaxLength: PROMPT_MAX_LENGTH,
  promptViolationLimitPerDay: getPromptViolationLimitPerDay(),
});

const testAdminPrompt = (input: unknown) => {
  const contextPrompt = input && typeof input === 'object' && 'contextPrompt' in input
    ? (input as { contextPrompt?: unknown }).contextPrompt
    : undefined;

  return validateVirtualTryOnPrompt(typeof contextPrompt === 'string' ? contextPrompt : undefined);
};

const retryAdminJob = async (jobId: string) => {
  const job = await VirtualTryOnJob.findOne({
    _id: toObjectId(jobId, 'job id'),
    deletedAt: null,
    status: { $in: ['failed', 'canceled'] },
  });

  if (!job) {
    throw new VirtualTryOnServiceError('Chỉ có thể thử lại job đã lỗi hoặc đã hủy', 400);
  }

  job.status = 'queued';
  job.progress = 0;
  job.generatedImageAssetIds = [];
  job.generatedImageUrls = [];
  job.generatedImageUrl = null;
  job.generatedVideoUrl = null;
  job.errorCode = null;
  job.errorMessage = null;
  job.startedAt = null;
  job.completedAt = null;
  await job.save();

  emitJob(job, 'queued');
  enqueueJob(job._id.toString());

  return serializeAdminJob(job);
};

const cancelAdminJob = async (jobId: string) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: toObjectId(jobId, 'job id'),
      deletedAt: null,
      status: { $in: ['queued', 'processing'] },
    },
    {
      status: 'canceled',
      progress: 100,
      completedAt: new Date(),
    },
    { new: true },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Không thể hủy job này', 400);
  }

  emitJob(job, 'canceled');
  return serializeAdminJob(job);
};

const hideAdminJob = async (jobId: string) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: toObjectId(jobId, 'job id'),
      deletedAt: null,
    },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Job phối đồ không tồn tại', 404);
  }

  return serializeAdminJob(job);
};

export const virtualTryOnService = {
  uploadAsset,
  listAssets,
  deleteAsset,
  validateAsset,
  createJob,
  getJob,
  getLatestJob,
  listJobs,
  retryJob,
  cancelJob,
  deleteJob,
  listAdminJobs,
  getAdminSummary,
  getAdminSettings,
  testAdminPrompt,
  retryAdminJob,
  cancelAdminJob,
  hideAdminJob,
};
