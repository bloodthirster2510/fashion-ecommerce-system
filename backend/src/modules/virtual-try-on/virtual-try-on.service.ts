import axios from 'axios';
import { Types } from 'mongoose';
import {
  Product,
  User,
  VirtualTryOnAsset,
  VirtualTryOnJob,
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
} from './providers';
import {
  createImageValidationProvider,
  getConfiguredImageValidationProviderName,
  getImageValidationReasonMessage,
  getImageValidationReasonStatus,
  type ImageValidationInput,
  type ImageValidationReasonCode,
  type ImageValidationResult,
} from './image-validation';
import { PROMPT_MAX_LENGTH, validateVirtualTryOnPrompt } from './prompt-policy/prompt-policy.service';
import type {
  CreateVirtualTryOnItemInput,
  CreateVirtualTryOnJobInput,
  UploadAssetSource,
  VirtualTryOnListQuery,
} from './virtual-try-on.types';

export class VirtualTryOnServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
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

const allowedRoles = new Set<VirtualTryOnItemRole>([
  'top',
  'bottom',
  'dress',
  'shoes',
  'accessory',
  'outerwear',
]);
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
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString(),
});

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
    generatedVideoUrl: job.generatedVideoUrl,
    errorMessage: job.errorMessage,
  });
};

const updateJobStatus = async (
  jobId: string,
  update: Partial<Pick<
    IVirtualTryOnJob,
    'status' | 'progress' | 'generatedImageAssetId' | 'generatedImageUrl' | 'generatedVideoAssetId' | 'generatedVideoUrl' | 'providerJobId' | 'errorCode' | 'errorMessage' | 'startedAt' | 'completedAt' | 'providerMetadata'
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
) => {
  const fallbackExtension = output.fileName.split('.').pop() || 'bin';
  const extension = mimeExtensions[output.mimeType] || fallbackExtension;
  return `${job._id.toString()}-${type}.${extension}`;
};

const persistGeneratedOutput = async (
  job: IVirtualTryOnJob,
  type: Extract<VirtualTryOnAssetType, 'generated_image' | 'generated_video'>,
  output: VirtualTryOnProviderBinaryOutput,
) => {
  const uploaded = await uploadToCloudinary(
    output.buffer,
    getGeneratedFileName(job, type, output),
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
    customPrompt: job.contextPrompt,
  });

  return {
    jobId: job._id.toString(),
    userId: job.userId.toString(),
    sourceImageUrl: job.sourceImageUrlSnapshot,
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

  let generatedImageUrl = providerResult.imageUrl;
  let generatedImageAssetId: Types.ObjectId | null = null;
  if (providerResult.image) {
    const persistedImage = await persistGeneratedOutput(job, 'generated_image', providerResult.image);
    generatedImageUrl = persistedImage.url;
    generatedImageAssetId = persistedImage.assetId;
  }
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
    generatedVideoUrl,
    generatedVideoAssetId,
    providerJobId: providerResult.providerJobId ?? null,
    providerMetadata: {
      ...(providerResult.metadata ?? {}),
      outputMode: job.outputMode,
      videoRequested: job.outputMode === 'image_and_video',
      videoReturned: Boolean(generatedVideoUrl),
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

const throwImageValidationError = (result: Pick<ImageValidationResult, 'reasonCode' | 'message'>): never => {
  const reasonCode = result.reasonCode || 'NO_PERSON_DETECTED';
  throw new VirtualTryOnServiceError(
    result.message || getImageValidationReasonMessage(reasonCode),
    getImageValidationReasonStatus(reasonCode),
    reasonCode,
  );
};

const validateSourceImageForJob = async (
  sourceAsset: IVirtualTryOnAsset,
  outfitMode: VirtualTryOnOutfitMode,
) => {
  const providerName = getConfiguredImageValidationProviderName();
  if (providerName === 'disabled') return;

  let result: ImageValidationResult | undefined;
  try {
    const { buffer, mimeType } = await downloadImageValidationBuffer(sourceAsset);
    const provider = createImageValidationProvider(providerName);
    result = applyImageValidationPolicy(await provider.validate({
      imageBuffer: buffer,
      mimeType,
      width: sourceAsset.width ?? 0,
      height: sourceAsset.height ?? 0,
      bytes: sourceAsset.bytes ?? buffer.byteLength,
      source: getImageValidationSource(sourceAsset),
      outfitMode,
    }));
  } catch (error) {
    if (shouldFailOpenImageValidation()) {
      console.warn('Image validation failed open:', error);
      return;
    }

    throwImageValidationError({
      reasonCode: 'VALIDATION_PROVIDER_FAILED',
      message: getImageValidationReasonMessage('VALIDATION_PROVIDER_FAILED'),
    });
  }

  if (!result) {
    throw new VirtualTryOnServiceError(
      getImageValidationReasonMessage('VALIDATION_PROVIDER_FAILED'),
      getImageValidationReasonStatus('VALIDATION_PROVIDER_FAILED'),
      'VALIDATION_PROVIDER_FAILED',
    );
  }

  if (!result.allowed) {
    throwImageValidationError(result);
  }
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
  const promptValidation = validateVirtualTryOnPrompt(input.contextPrompt);
  if (!promptValidation.allowed) {
    throw new VirtualTryOnServiceError(
      promptValidation.message || 'Mo ta boi canh khong hop le',
      400,
      promptValidation.reasonCode || 'PROMPT_INVALID',
    );
  }

  return {
    contextPreset,
    outputMode,
    contextPrompt: promptValidation.normalizedPrompt || undefined,
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
  });

  return serializeAsset(asset);
};

const listAssets = async (userId: string, query: VirtualTryOnListQuery) => {
  const { page, limit } = clampPagination(query);
  const type = typeof query.type === 'string' ? query.type : undefined;
  const filter: Record<string, unknown> = {
    userId: toObjectId(userId, 'user id'),
    status: 'active',
  };

  if (type) filter.type = type;

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

  const activeJobCount = await getActiveJobCount(userId);
  const maxConcurrent = Number(process.env.VIRTUAL_TRY_ON_MAX_CONCURRENT_JOBS_PER_USER || 1);
  if (activeJobCount >= maxConcurrent) {
    throw new VirtualTryOnServiceError('Bạn đang có yêu cầu phối đồ khác đang xử lý', 409, 'ACTIVE_JOB_EXISTS');
  }

  const sourceAsset = await findAssetForUser(userId, input.sourceAssetId);
  await validateSourceImageForJob(sourceAsset, input.outfitMode);

  const selectedItems = await resolveSelectedItems(input.selectedItems);

  const job = await VirtualTryOnJob.create({
    userId: userObjectId,
    sourceAssetId: sourceAsset._id,
    sourceImageUrlSnapshot: sourceAsset.url,
    selectedItems,
    outfitMode: input.outfitMode,
    contextPreset: normalized.contextPreset,
    contextPrompt: normalized.contextPrompt,
    outputMode: normalized.outputMode,
    status: 'queued',
    progress: 0,
    provider: PROVIDER,
    idempotencyKey: idempotencyKey || null,
    providerMetadata: {},
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
    latestFailedJobs,
  ] = await Promise.all([
    VirtualTryOnJob.countDocuments({ deletedAt: null }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, createdAt: { $gte: dayStart } }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'queued' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'processing' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'succeeded' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'failed' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'canceled' }),
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
