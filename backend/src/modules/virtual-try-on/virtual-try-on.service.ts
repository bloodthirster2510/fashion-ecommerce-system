import axios from 'axios';
import { Types } from 'mongoose';
import {
  Product,
  User,
  VirtualTryOnAsset,
  VirtualTryOnAccountLock,
  VirtualTryOnJob,
  VirtualTryOnPromptRule,
  VirtualTryOnPromptViolation,
  type IColorVariant,
  type IProduct,
  type IProductVariant,
  type IVirtualTryOnAsset,
  type IVirtualTryOnPromptRule,
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
import { interactionService } from '../interactions/interaction.service';
import {
  deleteVirtualTryOnJobNotifications,
  recordVirtualTryOnAccessNotification,
  recordVirtualTryOnOutcomeNotification,
  type VirtualTryOnOutcomeNotificationInput,
} from '../notifications/customer-notification.service';
import { sendCustomerPush } from '../notifications/push-notification.service';
import {
  buildVirtualTryOnPrompt,
  buildVirtualTryOnVideoPrompt,
  contextPresetPreviews,
  createVirtualTryOnProvider,
  createVirtualTryOnVideoProvider,
  getVirtualTryOnImageConfiguration,
  getVirtualTryOnVideoConfiguration,
  VirtualTryOnProviderError,
  VirtualTryOnVideoProviderError,
  type VirtualTryOnContextPresetPreview,
  type VirtualTryOnProviderBinaryOutput,
  type VirtualTryOnSourceImageProfile,
} from './providers';
import {
  applyImageValidationBasePolicy,
  checkImageValidationProviderHealth,
  createImageValidationProvider,
  getConfiguredImageValidationProviderName,
  getImageValidationReasonMessage,
  getImageValidationReasonStatus,
  isImageValidationFailOpen,
  isImageValidationReasonCode,
  isImageValidationSourceBlockReason,
  type ImageValidationBodyRegion,
  type ImageValidationCapability,
  type ImageValidationCapabilityMode,
  type ImageValidationInput,
  type ImageValidationReasonCode,
  type ImageValidationResult,
} from './image-validation';
import {
  escapeRegExp,
  redactVirtualTryOnPromptForAdmin,
  validateVirtualTryOnPrompt,
} from './prompt-policy/prompt-policy.service';
import type { PromptPolicyCategory, PromptPolicyRule } from './prompt-policy/prompt-policy.types';
import {
  virtualTryOnSettingsService,
  type VirtualTryOnRuntimeSettings,
} from './virtual-try-on-settings.service';
import {
  enqueueVirtualTryOnJob,
  isVirtualTryOnQueueEnabled,
  removeVirtualTryOnJobs,
  VirtualTryOnQueueError,
  type VirtualTryOnQueueProcessorContext,
} from './virtual-try-on.queue';
import {
  DEFAULT_VIRTUAL_TRY_ON_ATTEMPTS,
  hasVirtualTryOnRetryRemaining,
  isRetryableVirtualTryOnImageError,
  isRetryableVirtualTryOnVideoError,
} from './virtual-try-on-retry';
import type {
  CreateVirtualTryOnItemInput,
  CreateVirtualTryOnJobInput,
  UploadAssetSource,
  ValidateVirtualTryOnAssetInput,
  VirtualTryOnListQuery,
  VirtualTryOnPromptRuleListQuery,
  VirtualTryOnPromptViolationListQuery,
  CreatePromptRuleInput,
  UpdatePromptRuleInput,
  VirtualTryOnAccountLockListQuery,
  LockAccountInput,
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
const DEFAULT_PROVIDER = process.env.VIRTUAL_TRY_ON_PROVIDER?.trim() || 'mock';
const ENABLE_VIDEO = process.env.VIRTUAL_TRY_ON_ENABLE_VIDEO === 'true';
const DEFAULT_VIDEO_PROVIDER = process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER?.trim() || 'comfy_kling';
const IMAGE_VALIDATION_DOWNLOAD_TIMEOUT_MS = 15_000;
const terminalPolicyJobErrorCodes = new Set([
  'PROVIDER_SAFETY_BLOCKED',
]);
const terminalPolicyVideoErrorCodes = new Set([
  'VIDEO_PROVIDER_SAFETY_BLOCKED',
]);

const publicImageErrorMessages: Record<string, string> = {
  COMFY_TIMEOUT: 'Hệ thống phối đồ đang mất nhiều thời gian hơn dự kiến. Vui lòng thử lại sau.',
  COMFY_RATE_LIMITED: 'Hệ thống phối đồ đang bận. Vui lòng thử lại sau ít phút.',
  COMFY_NO_CREDITS: 'Dịch vụ phối đồ đang tạm gián đoạn. Vui lòng liên hệ hỗ trợ.',
  PROVIDER_SAFETY_BLOCKED: 'Ảnh hoặc nội dung chưa phù hợp với chính sách an toàn. Vui lòng chọn ảnh khác.',
  COMFY_OUTPUT_MISSING: 'Chưa thể tạo ảnh phối đồ từ lựa chọn này. Vui lòng thử lại.',
  PROVIDER_OUTPUT_MISSING: 'Chưa thể tạo ảnh phối đồ từ lựa chọn này. Vui lòng thử lại.',
  VIRTUAL_TRY_ON_DISABLED: 'Tính năng phối đồ ảo đang tạm tắt.',
};

const publicVideoErrorMessages: Record<string, string> = {
  VIDEO_PROVIDER_TIMEOUT: 'Video đang mất nhiều thời gian hơn dự kiến. Bạn có thể thử tạo lại video.',
  VIDEO_PROVIDER_RATE_LIMITED: 'Hệ thống tạo video đang bận. Vui lòng thử lại sau ít phút.',
  VIDEO_PROVIDER_NO_CREDITS: 'Dịch vụ tạo video đang tạm gián đoạn.',
  VIDEO_PROVIDER_SAFETY_BLOCKED: 'Không thể tạo video từ ảnh này do chính sách an toàn.',
  VIDEO_OUTPUT_MISSING: 'Ảnh phối đồ vẫn được giữ lại nhưng chưa thể tạo video.',
};

const getPublicImageErrorMessage = (errorCode: string) =>
  publicImageErrorMessages[errorCode] || 'Không thể tạo kết quả phối đồ lúc này. Vui lòng thử lại sau.';

const getPublicVideoErrorMessage = (errorCode: string) =>
  publicVideoErrorMessages[errorCode] || 'Ảnh phối đồ vẫn được giữ lại nhưng chưa thể tạo video.';

const assertPolicyRetryAllowed = (errorCode?: string | null, scope: 'job' | 'video' = 'job') => {
  const isPolicyViolation = scope === 'video'
    ? terminalPolicyVideoErrorCodes.has(errorCode || '')
    : terminalPolicyJobErrorCodes.has(errorCode || '');
  if (!isPolicyViolation) return;

  throw new VirtualTryOnServiceError(
    scope === 'video'
      ? 'Video đã bị đóng do vi phạm chính sách an toàn và không thể thử lại'
      : 'Yêu cầu đã bị đóng do ảnh vi phạm chính sách an toàn và không thể thử lại',
    403,
    'POLICY_VIOLATION_JOB_CLOSED',
  );
};

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
const normalizeVirtualTryOnRuleText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
const fullOutfitProductPattern =
  /(^|[\s/.-])(full set|bo do|bo mac|bo ao|bo quan|bo ao quan|bo vest|bo suit|set|combo|outfit|suit|tracksuit|jumpsuit|romper|playsuit|two piece|2 piece)([\s/.-]|$)/;
const exactFullOutfitCategoryPattern = /^(bo|set|combo|outfit|full set)$/;
const getProductCategoryNameForTryOn = (product: IProduct) => {
  const category = product.category_id as unknown;

  if (category && typeof category === 'object' && 'name' in category) {
    const name = (category as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }

  return '';
};
const isVirtualTryOnFullOutfitText = (value: string) =>
  fullOutfitProductPattern.test(normalizeVirtualTryOnRuleText(value));
const isVirtualTryOnFullOutfitCategoryText = (value: string) => {
  const normalizedValue = normalizeVirtualTryOnRuleText(value).trim();
  return fullOutfitProductPattern.test(normalizedValue) || exactFullOutfitCategoryPattern.test(normalizedValue);
};
const isVirtualTryOnFullOutfitProduct = (product: IProduct) =>
  isVirtualTryOnFullOutfitText(product.name) ||
  isVirtualTryOnFullOutfitCategoryText(getProductCategoryNameForTryOn(product));
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
const promptPolicyCategoryReasonCodes: Record<PromptPolicyCategory, string> = {
  sexual_content: 'PROMPT_SEXUAL_CONTENT',
  violence: 'PROMPT_VIOLENCE',
  prompt_injection: 'PROMPT_INJECTION',
  personal_data: 'PROMPT_PERSONAL_DATA',
  hate_or_harassment: 'PROMPT_HATE_OR_HARASSMENT',
  unsafe_request: 'PROMPT_UNSAFE_REQUEST',
};
const allowedPromptPolicyCategories = new Set<PromptPolicyCategory>(
  Object.keys(promptPolicyCategoryReasonCodes) as PromptPolicyCategory[],
);

const ensureVirtualTryOnAccountEnabled = async (userObjectId: Types.ObjectId) => {
  const lock = await VirtualTryOnAccountLock.findOne({
    userId: userObjectId,
    isLocked: true,
  });

  if (!lock) return;

  throw new VirtualTryOnServiceError(
    lock.reason
      ? `Tính năng phối đồ ảo đang bị hạn chế: ${lock.reason}`
      : 'Tính năng phối đồ ảo đang bị hạn chế',
    403,
    'VIRTUAL_TRY_ON_FEATURE_LOCKED',
    {
      lockedAt: lock.lockedAt?.toISOString() ?? null,
      reason: lock.reason ?? null,
    },
  );
};

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

const getLocalDayRange = (value = new Date()) => {
  const vietnamTime = new Date(value.getTime() + VIETNAM_UTC_OFFSET_MS);
  const start = new Date(Date.UTC(
    vietnamTime.getUTCFullYear(),
    vietnamTime.getUTCMonth(),
    vietnamTime.getUTCDate(),
  ) - VIETNAM_UTC_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
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

const getActorObjectId = (actorUserId?: string) =>
  actorUserId && Types.ObjectId.isValid(actorUserId) ? new Types.ObjectId(actorUserId) : null;

const resolveUserForFeatureLock = async (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new VirtualTryOnServiceError('Email hoặc mã khách hàng không hợp lệ', 400);
  }

  const identifier = value.trim().toLowerCase();
  const user = Types.ObjectId.isValid(identifier)
    ? await User.findById(identifier).select('_id').lean<{ _id: Types.ObjectId } | null>()
    : await User.findOne({ email: identifier }).select('_id').lean<{ _id: Types.ObjectId } | null>();

  if (!user) {
    throw new VirtualTryOnServiceError('Không tìm thấy khách hàng theo email hoặc mã đã nhập', 404);
  }

  return user;
};

const normalizePromptRuleTerm = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new VirtualTryOnServiceError('Cụm từ cần chặn không hợp lệ', 400);
  }

  const term = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (term.length < 2 || term.length > 120) {
    throw new VirtualTryOnServiceError('Cụm từ cần chặn phải từ 2 đến 120 ký tự', 400);
  }

  return term;
};

const normalizePromptRuleCategory = (value: unknown): PromptPolicyCategory => {
  if (typeof value !== 'string' || !allowedPromptPolicyCategories.has(value as PromptPolicyCategory)) {
    throw new VirtualTryOnServiceError('Loại vi phạm không hợp lệ', 400);
  }

  return value as PromptPolicyCategory;
};

const getPromptRuleReasonCode = (category: PromptPolicyCategory, reasonCode?: unknown) => {
  if (typeof reasonCode === 'string' && reasonCode.trim()) {
    return reasonCode.trim().slice(0, 80);
  }

  return promptPolicyCategoryReasonCodes[category];
};

const serializePromptRule = (rule: IVirtualTryOnPromptRule) => ({
  _id: rule._id.toString(),
  term: rule.term,
  category: rule.category,
  reasonCode: rule.reasonCode,
  enabled: rule.enabled,
  createdAt: rule.createdAt.toISOString(),
  updatedAt: rule.updatedAt.toISOString(),
});

const serializeAccountLock = async (lock: {
  userId: Types.ObjectId;
  isLocked: boolean;
  reason?: string | null;
  lockedBy?: Types.ObjectId | null;
  unlockedBy?: Types.ObjectId | null;
  lockedAt?: Date | null;
  unlockedAt?: Date | null;
  updatedAt: Date;
}) => {
  const [user, lockedBy, unlockedBy] = await Promise.all([
    User.findById(lock.userId).select('_id name email isActive').lean<{
      _id: Types.ObjectId;
      name?: string;
      email?: string;
      isActive?: boolean;
    } | null>(),
    lock.lockedBy
      ? User.findById(lock.lockedBy).select('_id name email').lean<{ _id: Types.ObjectId; name?: string; email?: string } | null>()
      : Promise.resolve(null),
    lock.unlockedBy
      ? User.findById(lock.unlockedBy).select('_id name email').lean<{ _id: Types.ObjectId; name?: string; email?: string } | null>()
      : Promise.resolve(null),
  ]);

  return {
    user: user
      ? {
          _id: user._id.toString(),
          name: user.name ?? '',
          email: user.email ?? '',
          isActive: user.isActive !== false,
        }
      : {
          _id: lock.userId.toString(),
          name: '',
          email: '',
          isActive: false,
        },
    isLocked: lock.isLocked,
    reason: lock.reason ?? null,
    lockedBy: lockedBy
      ? { _id: lockedBy._id.toString(), name: lockedBy.name ?? '', email: lockedBy.email ?? '' }
      : null,
    unlockedBy: unlockedBy
      ? { _id: unlockedBy._id.toString(), name: unlockedBy.name ?? '', email: unlockedBy.email ?? '' }
      : null,
    lockedAt: lock.lockedAt?.toISOString() ?? null,
    unlockedAt: lock.unlockedAt?.toISOString() ?? null,
    updatedAt: lock.updatedAt.toISOString(),
  };
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

const serializeAssetValidationWarning = (asset: IVirtualTryOnAsset) => {
  const reasonCode = asset.validationWarning?.reasonCode?.trim();
  if (!reasonCode) return undefined;

  return {
    reasonCode,
    message: asset.validationWarning?.message?.trim() || getImageValidationReasonMessage(reasonCode),
  };
};

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
  validationWarning: serializeAssetValidationWarning(asset),
  validationCheckedAt: asset.validationCheckedAt?.toISOString() ?? null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString(),
});

const getGeneratedImageUrls = (job: Pick<IVirtualTryOnJob, 'generatedImageUrl' | 'generatedImageUrls'>) => {
  const urls = [...(job.generatedImageUrls ?? []), job.generatedImageUrl]
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));

  return [...new Set(urls)];
};

const notifyVirtualTryOnOutcomeBestEffort = async (input: VirtualTryOnOutcomeNotificationInput) => {
  const notification = await recordVirtualTryOnOutcomeNotification(input);
  if (!notification) return;

  await sendCustomerPush({
    userId: input.userId,
    title: notification.title,
    body: notification.body,
    notificationId: String(notification._id),
    category: 'virtual_try_on',
    data: {
      type: 'virtual_try_on',
      jobId: input.jobId,
      outcome: input.outcome,
      destination: notification.action?.type === 'virtual_try_on_result' ? 'result' : 'processing',
    },
    disabled: process.env.VIRTUAL_TRY_ON_PUSH_NOTIFICATIONS === 'false',
  }).catch((error) => {
    console.warn('Failed to send virtual try-on push:', error);
  });
};

const notifyVirtualTryOnAccessBestEffort = async (input: {
  userId: string;
  state: 'locked' | 'unlocked' | 'prompt_blocked';
  eventKey: string;
  blockedUntil?: Date | null;
  sendPush?: boolean;
}) => {
  const notification = await recordVirtualTryOnAccessNotification(input);
  if (!notification || !input.sendPush) return;

  await sendCustomerPush({
    userId: input.userId,
    title: notification.title,
    body: notification.body,
    notificationId: String(notification._id),
    category: 'virtual_try_on',
    data: { type: 'virtual_try_on_access', destination: 'home', accessState: input.state },
    disabled: process.env.VIRTUAL_TRY_ON_PUSH_NOTIFICATIONS === 'false',
  }).catch((error) => {
    console.warn('Failed to send virtual try-on access push:', error);
  });
};

const getVideoCapabilities = (settings?: VirtualTryOnRuntimeSettings) => {
  const provider = settings?.videoProvider || DEFAULT_VIDEO_PROVIDER;
  const model = settings?.videoModel || process.env.VIRTUAL_TRY_ON_VIDEO_MODEL?.trim();
  const configuration = getVirtualTryOnVideoConfiguration({
    provider,
    model,
    durationSeconds: settings?.videoDurationSeconds,
    resolution: settings?.videoResolution,
    aspectRatio: settings?.videoAspectRatio,
    generateAudio: settings?.videoGenerateAudio,
  });
  const available = ENABLE_VIDEO && provider !== 'disabled' && configuration.ready;
  return {
    enabled: ENABLE_VIDEO,
    available,
    reasonCode: available
      ? null
      : !ENABLE_VIDEO
        ? 'VIDEO_GENERATION_DISABLED'
        : configuration.issues[0] || 'VIDEO_PROVIDER_CONFIG_MISSING',
    provider: configuration.provider,
    model: configuration.model,
    durationSeconds: configuration.durationSeconds,
    minDurationSeconds: configuration.minDurationSeconds,
    maxDurationSeconds: configuration.maxDurationSeconds,
    resolution: configuration.resolution,
    aspectRatio: configuration.aspectRatio,
    generateAudio: configuration.generateAudio,
  };
};

const getStringMetadataValue = (
  metadata: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumberMetadataValue = (
  metadata: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getBooleanMetadataValue = (
  metadata: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === 'boolean' ? value : undefined;
};

const getEffectiveVideoResult = (job: IVirtualTryOnJob) => {
  const storedUrl = job.generatedVideoUrl?.trim() || null;
  let status = job.videoStatus || (job.outputMode === 'image' ? 'not_requested' : 'queued');

  if (job.outputMode === 'image') {
    status = 'not_requested';
  } else if (status === 'succeeded') {
    status = storedUrl ? 'succeeded' : 'failed';
  } else if (status !== 'failed' && status !== 'canceled') {
    if (job.status === 'succeeded') {
      status = storedUrl ? 'succeeded' : 'failed';
    } else if (job.status === 'failed' || job.status === 'canceled') {
      status = 'canceled';
    } else if (status === 'not_requested') {
      status = 'queued';
    }
  }

  const isFailed = status === 'failed';
  return {
    status,
    url: status === 'succeeded' ? storedUrl : null,
    errorCode: isFailed ? job.videoErrorCode?.trim() || 'VIDEO_OUTPUT_MISSING' : null,
    errorMessage: isFailed
      ? job.videoErrorMessage?.trim() || 'Không thể tạo video từ ảnh phối đồ đã sinh.'
      : null,
  };
};

const getEffectiveProcessingStage = (job: IVirtualTryOnJob) => {
  if (job.processingStage) return job.processingStage;
  if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'canceled') return 'completed' as const;
  return job.status === 'queued' ? 'queued' as const : 'image_generation' as const;
};

const serializeJob = async (job: IVirtualTryOnJob) => {
  const sourceAsset = await VirtualTryOnAsset.findOne({
    _id: job.sourceAssetId,
    userId: job.userId,
  });
  const generatedImageUrls = getGeneratedImageUrls(job);
  const videoResult = getEffectiveVideoResult(job);
  return {
    _id: job._id.toString(),
    status: job.status,
    progress: job.progress,
    processingStage: getEffectiveProcessingStage(job),
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
    videoDurationSeconds: job.videoDurationSeconds ?? null,
    generatedImageUrl: generatedImageUrls[0] ?? null,
    generatedImageUrls,
    generatedVideoUrl: videoResult.url,
    videoStatus: videoResult.status,
    videoProgress: job.videoProgress ?? 0,
    videoSourceImageUrl: job.videoSourceImageUrlSnapshot ?? null,
    videoProvider: job.videoProvider ?? null,
    videoProviderJobId: job.videoProviderJobId ?? null,
    videoErrorCode: videoResult.errorCode,
    videoErrorMessage: videoResult.errorMessage,
    videoStartedAt: job.videoStartedAt?.toISOString() ?? null,
    videoCompletedAt: job.videoCompletedAt?.toISOString() ?? null,
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
  const generatedImageUrls = getGeneratedImageUrls(job);
  const videoResult = getEffectiveVideoResult(job);
  emitVirtualTryOnJobEvent(job.userId.toString(), {
    type,
    jobId: job._id.toString(),
    status: job.status,
    progress: job.progress,
    processingStage: getEffectiveProcessingStage(job),
    generatedImageUrl: generatedImageUrls[0] ?? null,
    generatedImageUrls,
    generatedVideoUrl: videoResult.url,
    videoStatus: videoResult.status,
    videoProgress: job.videoProgress ?? 0,
    videoErrorCode: videoResult.errorCode,
    videoErrorMessage: videoResult.errorMessage,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    updatedAt: job.updatedAt.toISOString(),
  });
};

const updateJobStatus = async (
  jobId: string,
  update: Partial<Pick<
    IVirtualTryOnJob,
    'status' | 'progress' | 'processingStage' | 'generatedImageAssetId' | 'generatedImageUrl' | 'generatedImageAssetIds' | 'generatedImageUrls' | 'generatedVideoAssetId' | 'generatedVideoUrl' | 'videoStatus' | 'videoProgress' | 'videoSourceImageAssetId' | 'videoSourceImageUrlSnapshot' | 'videoProvider' | 'videoProviderJobId' | 'videoProviderMetadata' | 'videoErrorCode' | 'videoErrorMessage' | 'videoStartedAt' | 'videoCompletedAt' | 'providerJobId' | 'errorCode' | 'errorMessage' | 'startedAt' | 'completedAt' | 'providerMetadata'
  >>,
  eventType: 'queued' | 'processing' | 'progress' | 'succeeded' | 'failed' | 'canceled',
) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    { _id: jobId, deletedAt: null, status: { $nin: ['canceled'] } },
    update,
    { returnDocument: 'after' },
  );
  if (job) emitJob(job, eventType);
  return job;
};

export type PersistedGeneratedAsset = {
  assetId: Types.ObjectId;
  publicId: string;
  resourceType: 'image' | 'video';
};

type VirtualTryOnImageResult = {
  generatedImageUrl: string;
  generatedImageAssetId?: Types.ObjectId | null;
  generatedImageUrls: string[];
  generatedImageAssetIds?: Types.ObjectId[];
  providerJobId?: string | null;
  providerMetadata?: Record<string, unknown>;
  persistedAssets: PersistedGeneratedAsset[];
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

export const persistGeneratedOutput = async (
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

  let asset: IVirtualTryOnAsset;
  try {
    asset = await VirtualTryOnAsset.create({
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
  } catch (error) {
    await deleteFromCloudinary(
      uploaded.public_id,
      type === 'generated_video' ? 'video' : 'image',
    ).catch((cleanupError) => {
      console.warn('Virtual try-on generated upload cleanup failed:', cleanupError);
    });
    throw error;
  }

  return {
    assetId: asset._id as Types.ObjectId,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    resourceType: type === 'generated_video' ? 'video' as const : 'image' as const,
  };
};

const getImageCapabilities = (settings: VirtualTryOnRuntimeSettings) => {
  const configuration = getVirtualTryOnImageConfiguration({ provider: settings.imageProvider });
  const available = settings.enabled && configuration.ready;
  return {
    available,
    provider: settings.imageProvider,
    reasonCode: available
      ? null
      : !settings.enabled || settings.imageProvider === 'disabled'
        ? 'VIRTUAL_TRY_ON_DISABLED'
        : configuration.issues[0] || 'PROVIDER_NOT_CONFIGURED',
  };
};

export const cleanupGeneratedAssetsBestEffort = async (assets: PersistedGeneratedAsset[]) => {
  await Promise.all(assets.map(async (asset) => {
    try {
      const deletedAsset = await VirtualTryOnAsset.findOneAndUpdate(
        { _id: asset.assetId, status: 'active' },
        { status: 'deleted', deletedAt: new Date() },
        { returnDocument: 'after' },
      );
      if (!deletedAsset) return;
      await deleteFromCloudinary(asset.publicId, asset.resourceType);
    } catch (error) {
      console.warn(`Virtual try-on orphan asset cleanup failed for ${asset.assetId.toString()}:`, error);
    }
  }));
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
    outputMode: 'image' as const,
    garments,
    context: {
      preset: job.contextPreset,
      prompt: job.contextPrompt,
      preserveOriginalBackground: job.contextPreset === 'none',
    },
    prompt: prompt.prompt,
    negativePrompt: prompt.negativePrompt,
    model: typeof job.providerMetadata?.model === 'string'
      && job.providerMetadata.model !== 'workflow_default'
      ? job.providerMetadata.model
      : undefined,
    aspectRatio: getStringMetadataValue(job.providerMetadata, 'imageAspectRatio')
      || getStringMetadataValue(job.providerMetadata, 'aspectRatio'),
    resolution: getStringMetadataValue(job.providerMetadata, 'imageResolution')
      || getStringMetadataValue(job.providerMetadata, 'resolution'),
  };
};

const generateVirtualTryOnResult = async (job: IVirtualTryOnJob): Promise<VirtualTryOnImageResult> => {
  const provider = createVirtualTryOnProvider(job.provider || DEFAULT_PROVIDER);
  const providerResult = await provider.generate({
    ...buildProviderInput(job),
    providerJobId: job.providerJobId,
    onProviderJobSubmitted: async (providerJobId, metadata) => {
      const updatedJob = await updateJobStatus(
        job._id.toString(),
        {
          providerJobId,
          providerMetadata: {
            ...(job.providerMetadata || {}),
            ...(metadata || {}),
          },
        },
        'progress',
      );
      if (!updatedJob) {
        throw new VirtualTryOnProviderError(
          'Virtual try-on job is no longer active',
          409,
          'JOB_CANCELED',
        );
      }
      job.providerJobId = providerJobId;
      job.providerMetadata = updatedJob.providerMetadata;
    },
  });

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

  const persistedAssets: PersistedGeneratedAsset[] = [];
  try {
    for (const [index, imageOutput] of imageOutputs.entries()) {
      const persistedImage = await persistGeneratedOutput(job, 'generated_image', imageOutput, index + 1);
      generatedImageUrls.push(persistedImage.url);
      generatedImageAssetIds.push(persistedImage.assetId);
      persistedAssets.push(persistedImage);
    }
  } catch (error) {
    await cleanupGeneratedAssetsBestEffort(persistedAssets);
    throw error;
  }

  const normalizedImageUrls = [...new Set(
    generatedImageUrls
      .map((url) => url?.trim())
      .filter((url): url is string => Boolean(url)),
  )];
  const generatedImageUrl = normalizedImageUrls[0];
  const generatedImageAssetId = generatedImageAssetIds[0] ?? null;
  if (!generatedImageUrl) {
    throw new VirtualTryOnProviderError('Provider did not return a generated image', 502, 'PROVIDER_OUTPUT_MISSING');
  }

  return {
    generatedImageUrl,
    generatedImageAssetId,
    generatedImageUrls: normalizedImageUrls,
    generatedImageAssetIds,
    providerJobId: providerResult.providerJobId ?? null,
    providerMetadata: {
      ...(providerResult.metadata ?? {}),
      imageCount: generatedImageUrls.length,
    },
    persistedAssets,
  };
};

const delay = (ms: number) => {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
};

const updateActiveVideoJob = async (
  jobId: string,
  update: Parameters<typeof updateJobStatus>[1],
  eventType: Parameters<typeof updateJobStatus>[2],
) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: jobId,
      deletedAt: null,
      status: 'processing',
      videoStatus: { $ne: 'canceled' },
    },
    update,
    { returnDocument: 'after' },
  );
  if (job) emitJob(job, eventType);
  return job;
};

const getVideoProviderError = (error: unknown) => {
  if (error instanceof VirtualTryOnVideoProviderError) return error;
  return new VirtualTryOnVideoProviderError(
    error instanceof Error ? error.message : 'Không thể tạo video lúc này',
  );
};

const runVideoStage = async (
  jobId: string,
  retryContext?: VirtualTryOnQueueProcessorContext,
) => {
  let unattachedVideoAsset: PersistedGeneratedAsset | null = null;
  try {
    let job = await VirtualTryOnJob.findOne({
      _id: jobId,
      deletedAt: null,
      status: 'processing',
      outputMode: 'image_and_video',
      videoStatus: { $in: ['queued', 'processing'] },
    });
    if (!job) return;

    const videoProviderMetadata = job.videoProviderMetadata || {};
    const videoProvider = job.videoProvider?.trim() || DEFAULT_VIDEO_PROVIDER;
    const videoModel = getStringMetadataValue(videoProviderMetadata, 'model')
      || process.env.VIRTUAL_TRY_ON_VIDEO_MODEL?.trim();
    const videoDurationSeconds = job.videoDurationSeconds
      ?? getNumberMetadataValue(videoProviderMetadata, 'durationSeconds');
    const videoConfiguration = getVirtualTryOnVideoConfiguration({
      provider: videoProvider,
      model: videoModel,
      durationSeconds: videoDurationSeconds ?? undefined,
      resolution: getStringMetadataValue(videoProviderMetadata, 'resolution'),
      aspectRatio: getStringMetadataValue(videoProviderMetadata, 'aspectRatio'),
      generateAudio: getBooleanMetadataValue(videoProviderMetadata, 'generateAudio'),
    });
    if (!ENABLE_VIDEO) {
      throw new VirtualTryOnVideoProviderError(
        'Tính năng sinh video đang tắt',
        503,
        'VIDEO_GENERATION_DISABLED',
      );
    }
    if (!videoConfiguration.ready) {
      throw new VirtualTryOnVideoProviderError(
        'Cấu hình workflow sinh video chưa sẵn sàng',
        503,
        'VIDEO_PROVIDER_CONFIG_MISSING',
      );
    }

    const sourceImageUrl = job.videoSourceImageUrlSnapshot || getGeneratedImageUrls(job)[0];
    if (!sourceImageUrl) {
      throw new VirtualTryOnVideoProviderError(
        'Không tìm thấy ảnh phối đồ để tạo video',
        422,
        'VIDEO_SOURCE_IMAGE_MISSING',
      );
    }

    const provider = createVirtualTryOnVideoProvider(videoProvider);
    let providerJobId = job.videoProviderJobId || null;
    let providerMetadata = { ...videoProviderMetadata };

    if (!providerJobId) {
      const durationSeconds = videoDurationSeconds ?? videoConfiguration.durationSeconds;
      const videoPrompt = buildVirtualTryOnVideoPrompt({
        preset: job.contextPreset,
        durationSeconds,
        customPrompt: job.contextPrompt,
      });
      job = await updateActiveVideoJob(
        jobId,
        {
          processingStage: 'video_generation',
          progress: 70,
          videoStatus: 'processing',
          videoProgress: 10,
          videoStartedAt: job.videoStartedAt || new Date(),
          videoProvider,
          videoErrorCode: null,
          videoErrorMessage: null,
        },
        'progress',
      );
      if (!job) return;

      const submission = await provider.submit({
        jobId: job._id.toString(),
        userId: job.userId.toString(),
        sourceImageUrl,
        prompt: videoPrompt.prompt,
        negativePrompt: videoPrompt.negativePrompt,
        model: videoConfiguration.model,
        durationSeconds,
        resolution: videoConfiguration.resolution,
        aspectRatio: videoConfiguration.aspectRatio,
        generateAudio: videoConfiguration.generateAudio,
      });
      providerJobId = submission.providerJobId;
      providerMetadata = {
        ...providerMetadata,
        ...(submission.metadata || {}),
        prompt: videoPrompt.prompt,
        negativePrompt: videoPrompt.negativePrompt,
      };
      job = await updateActiveVideoJob(
        jobId,
        {
          progress: 75,
          videoProgress: 25,
          videoProviderJobId: providerJobId,
          videoProviderMetadata: providerMetadata,
        },
        'progress',
      );
      if (!job) return;
    }

    const providerResult = await provider.waitForResult(providerJobId);
    job = await updateActiveVideoJob(
      jobId,
      {
        processingStage: 'video_persisting',
        progress: 97,
        videoProgress: 90,
      },
      'progress',
    );
    if (!job) return;

    let generatedVideoUrl = providerResult.videoUrl?.trim() || null;
    let generatedVideoAssetId: Types.ObjectId | null = null;
    if (providerResult.video) {
      const persistedVideo = await persistGeneratedOutput(job, 'generated_video', providerResult.video);
      generatedVideoUrl = persistedVideo.url;
      generatedVideoAssetId = persistedVideo.assetId;
      unattachedVideoAsset = persistedVideo;
    }
    if (!generatedVideoUrl) {
      throw new VirtualTryOnVideoProviderError(
        'Provider không trả video',
        502,
        'VIDEO_OUTPUT_MISSING',
      );
    }

    const completedJob = await updateActiveVideoJob(
      jobId,
      {
        status: 'succeeded',
        progress: 100,
        processingStage: 'completed',
        generatedVideoAssetId,
        generatedVideoUrl,
        videoStatus: 'succeeded',
        videoProgress: 100,
        videoProviderMetadata: {
          ...providerMetadata,
          ...(providerResult.metadata || {}),
        },
        videoErrorCode: null,
        videoErrorMessage: null,
        videoCompletedAt: new Date(),
        completedAt: new Date(),
      },
      'succeeded',
    );
    if (!completedJob) {
      if (unattachedVideoAsset) await cleanupGeneratedAssetsBestEffort([unattachedVideoAsset]);
      return;
    }
    unattachedVideoAsset = null;
    if (completedJob) {
      await notifyVirtualTryOnOutcomeBestEffort({
        userId: completedJob.userId.toString(),
        jobId: completedJob._id.toString(),
        outcome: 'completed',
        outputMode: completedJob.outputMode,
        generatedImageCount: getGeneratedImageUrls(completedJob).length,
        imageUrl: getGeneratedImageUrls(completedJob)[0] ?? null,
        videoStatus: 'succeeded',
        retryable: false,
      });
    }
  } catch (error) {
    if (unattachedVideoAsset) await cleanupGeneratedAssetsBestEffort([unattachedVideoAsset]);
    const providerError = getVideoProviderError(error);
    console.error('Virtual try-on video stage failed:', providerError);
    const activeJob = await VirtualTryOnJob.findOne({
      _id: jobId,
      deletedAt: null,
      status: 'processing',
      videoStatus: { $in: ['queued', 'processing'] },
    });
    if (
      activeJob
      && hasVirtualTryOnRetryRemaining(retryContext)
      && isRetryableVirtualTryOnVideoError(
        providerError.errorCode,
        Boolean(activeJob.videoProviderJobId),
      )
    ) {
      throw providerError;
    }
    const partialJob = await updateActiveVideoJob(
      jobId,
      {
        status: 'succeeded',
        progress: 100,
        processingStage: 'completed',
        generatedVideoAssetId: null,
        generatedVideoUrl: null,
        videoStatus: 'failed',
        videoProgress: 100,
        videoErrorCode: providerError.errorCode,
        videoErrorMessage: getPublicVideoErrorMessage(providerError.errorCode),
        videoCompletedAt: new Date(),
        completedAt: new Date(),
      },
      'succeeded',
    );
    if (partialJob) {
      await notifyVirtualTryOnOutcomeBestEffort({
        userId: partialJob.userId.toString(),
        jobId: partialJob._id.toString(),
        outcome: 'partial_video_failed',
        outputMode: partialJob.outputMode,
        generatedImageCount: getGeneratedImageUrls(partialJob).length,
        imageUrl: getGeneratedImageUrls(partialJob)[0] ?? null,
        videoStatus: 'failed',
        errorCode: providerError.errorCode,
        retryable: !terminalPolicyVideoErrorCodes.has(providerError.errorCode),
      });
    }
  }
};

const runProviderJob = async (
  jobId: string,
  retryContext?: VirtualTryOnQueueProcessorContext,
) => {
  let unattachedImageAssets: PersistedGeneratedAsset[] = [];
  try {
    const resumableJob = await VirtualTryOnJob.findOne({
      _id: jobId,
      deletedAt: null,
      status: { $in: ['queued', 'processing'] },
    });
    if (!resumableJob) return;

    if (getGeneratedImageUrls(resumableJob).length > 0) {
      if (resumableJob.outputMode === 'image_and_video') {
        await enqueueVideoJob(jobId);
        return;
      }

      const completedJob = await updateJobStatus(
        jobId,
        {
          status: 'succeeded',
          progress: 100,
          processingStage: 'completed',
          completedAt: new Date(),
        },
        'succeeded',
      );
      if (completedJob) {
        await notifyVirtualTryOnOutcomeBestEffort({
          userId: completedJob.userId.toString(),
          jobId: completedJob._id.toString(),
          outcome: 'completed',
          outputMode: completedJob.outputMode,
          generatedImageCount: getGeneratedImageUrls(completedJob).length,
          imageUrl: getGeneratedImageUrls(completedJob)[0] ?? null,
          videoStatus: 'not_requested',
          retryable: false,
        });
      }
      return;
    }

    await delay(350);
    let job = await updateJobStatus(
      jobId,
      {
        status: 'processing',
        progress: 25,
        processingStage: 'image_generation',
        startedAt: new Date(),
      },
      'processing',
    );
    if (!job) return;

    await delay(900);
    job = await updateJobStatus(
      jobId,
      { status: 'processing', progress: 55, processingStage: 'image_generation' },
      'progress',
    );
    if (!job) return;

    const providerResult = await generateVirtualTryOnResult(job);
    unattachedImageAssets = providerResult.persistedAssets;

    const imageReadyJob = await updateJobStatus(
      jobId,
      {
        status: 'processing',
        progress: 65,
        processingStage: 'image_persisting',
        generatedImageAssetId: providerResult.generatedImageAssetId ?? null,
        generatedImageUrl: providerResult.generatedImageUrl,
        generatedImageAssetIds: providerResult.generatedImageAssetIds ?? [],
        generatedImageUrls: providerResult.generatedImageUrls,
        providerJobId: providerResult.providerJobId ?? null,
        providerMetadata: {
          ...(job.providerMetadata || {}),
          ...(providerResult.providerMetadata ?? {}),
        },
        videoStatus: job.outputMode === 'image_and_video' ? 'queued' : 'not_requested',
        videoProgress: 0,
        videoSourceImageAssetId: providerResult.generatedImageAssetId ?? null,
        videoSourceImageUrlSnapshot: providerResult.generatedImageUrl,
        videoProvider: job.outputMode === 'image_and_video'
          ? job.videoProvider || DEFAULT_VIDEO_PROVIDER
          : null,
      },
      'progress',
    );
    if (!imageReadyJob) {
      await cleanupGeneratedAssetsBestEffort(unattachedImageAssets);
      return;
    }
    unattachedImageAssets = [];

    if (imageReadyJob.outputMode === 'image') {
      const completedJob = await updateJobStatus(
        jobId,
        {
          status: 'succeeded',
          progress: 100,
          processingStage: 'completed',
          completedAt: new Date(),
        },
        'succeeded',
      );
      if (completedJob) {
        await notifyVirtualTryOnOutcomeBestEffort({
          userId: completedJob.userId.toString(),
          jobId: completedJob._id.toString(),
          outcome: 'completed',
          outputMode: completedJob.outputMode,
          generatedImageCount: getGeneratedImageUrls(completedJob).length,
          imageUrl: getGeneratedImageUrls(completedJob)[0] ?? null,
          videoStatus: 'not_requested',
          retryable: false,
        });
      }
      return;
    }

    await enqueueVideoJob(jobId);
  } catch (error) {
    if (unattachedImageAssets.length > 0) {
      await cleanupGeneratedAssetsBestEffort(unattachedImageAssets);
    }
    if (error instanceof VirtualTryOnQueueError) throw error;
    console.error('Virtual try-on provider worker failed:', error);
    const serviceError = error instanceof VirtualTryOnServiceError
      ? error
      : error instanceof VirtualTryOnProviderError
        ? new VirtualTryOnServiceError(error.message, error.statusCode, error.errorCode)
        : null;
    const errorCode = serviceError?.errorCode ?? 'UNKNOWN';
    const activeJob = await VirtualTryOnJob.findOne({
      _id: jobId,
      deletedAt: null,
      status: { $in: ['queued', 'processing'] },
    });
    if (
      activeJob
      && hasVirtualTryOnRetryRemaining(retryContext)
      && isRetryableVirtualTryOnImageError(errorCode, Boolean(activeJob.providerJobId))
    ) {
      throw serviceError || error;
    }
    const failedJob = await updateJobStatus(
      jobId,
      {
        status: 'failed',
        progress: 100,
        processingStage: 'completed',
        videoStatus: 'canceled',
        videoProgress: 100,
        errorCode,
        errorMessage: getPublicImageErrorMessage(errorCode),
        completedAt: new Date(),
      },
      'failed',
    );
    if (failedJob) {
      const isPolicyBlocked = terminalPolicyJobErrorCodes.has(errorCode);
      await notifyVirtualTryOnOutcomeBestEffort({
        userId: failedJob.userId.toString(),
        jobId: failedJob._id.toString(),
        outcome: isPolicyBlocked ? 'policy_blocked' : 'failed',
        outputMode: failedJob.outputMode,
        generatedImageCount: getGeneratedImageUrls(failedJob).length,
        imageUrl: getGeneratedImageUrls(failedJob)[0] ?? null,
        videoStatus: failedJob.videoStatus,
        errorCode,
        retryable: !isPolicyBlocked,
      });
    }
  }
};

const runInProcessWithRetries = async (
  processor: (
    jobId: string,
    context?: VirtualTryOnQueueProcessorContext,
  ) => Promise<void>,
  jobId: string,
) => {
  for (let attemptsMade = 0; attemptsMade < DEFAULT_VIRTUAL_TRY_ON_ATTEMPTS; attemptsMade += 1) {
    try {
      await processor(jobId, {
        attemptsMade,
        maxAttempts: DEFAULT_VIRTUAL_TRY_ON_ATTEMPTS,
      });
      return;
    } catch (error) {
      if (attemptsMade + 1 >= DEFAULT_VIRTUAL_TRY_ON_ATTEMPTS) {
        console.error(`Virtual try-on in-process job ${jobId} exhausted retries:`, error);
        return;
      }
      await delay(2_000 * (2 ** attemptsMade));
    }
  }
};

const enqueueJob = async (jobId: string) => {
  if (isVirtualTryOnQueueEnabled()) {
    await enqueueVirtualTryOnJob('image', jobId);
    return;
  }
  const timer = setTimeout(() => { void runInProcessWithRetries(runProviderJob, jobId); }, 0);
  timer.unref?.();
};

const enqueueVideoJob = async (jobId: string) => {
  if (isVirtualTryOnQueueEnabled()) {
    await enqueueVirtualTryOnJob('video', jobId);
    return;
  }
  const timer = setTimeout(() => { void runInProcessWithRetries(runVideoStage, jobId); }, 0);
  timer.unref?.();
};

const removeQueuedJobsBestEffort = async (jobId: string) => {
  if (!isVirtualTryOnQueueEnabled()) return;
  try {
    await removeVirtualTryOnJobs(jobId);
  } catch (error) {
    console.warn(`[virtual-try-on-queue] Failed to remove job ${jobId}:`, error);
  }
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
  _outfitMode: VirtualTryOnOutfitMode,
  itemRoles: VirtualTryOnItemRole[],
): ImageValidationCapabilityMode[] => {
  return Array.from(new Set(itemRoles.map((role) => role as ImageValidationCapabilityMode)));
};

const assertRuntimeEnabled = (settings: VirtualTryOnRuntimeSettings) => {
  const capabilities = getImageCapabilities(settings);
  if (!capabilities.available) {
    throw new VirtualTryOnServiceError(
      capabilities.reasonCode === 'VIRTUAL_TRY_ON_DISABLED'
        ? 'Tính năng phối đồ ảo đang tắt'
        : 'Cấu hình tạo ảnh phối đồ chưa sẵn sàng',
      503,
      capabilities.reasonCode || 'PROVIDER_NOT_CONFIGURED',
    );
  }
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
  if (!result.allowed && result.reasonCode !== 'BODY_NOT_VISIBLE') {
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
    return applySelectionCapabilityPolicy(result, outfitMode, itemRoles);
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
    return applyImageValidationBasePolicy(await provider.validate(input), getPersonScoreThreshold());
  } catch (error) {
    if (isImageValidationFailOpen()) {
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

  let downloaded: Awaited<ReturnType<typeof downloadImageValidationBuffer>>;
  try {
    downloaded = await downloadImageValidationBuffer(sourceAsset);
  } catch (error) {
    if (isImageValidationFailOpen()) {
      console.warn('Image validation source download failed open:', error);
      return createImageValidationFallbackResult(getConfiguredImageValidationProviderName(), {
        message: 'Image validation failed open',
      });
    }
    return createImageValidationFallbackResult(getConfiguredImageValidationProviderName(), {
      allowed: false,
      reasonCode: 'VALIDATION_PROVIDER_FAILED',
      message: getImageValidationReasonMessage('VALIDATION_PROVIDER_FAILED'),
    });
  }
  const { buffer, mimeType } = downloaded;
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
  if (
    suitabilityWarning &&
    isImageValidationSourceBlockReason(suitabilityWarning.reasonCode)
  ) {
    throw new VirtualTryOnServiceError(
      suitabilityWarning.message,
      getImageValidationReasonStatus(suitabilityWarning.reasonCode),
      suitabilityWarning.reasonCode,
      { reasonCode: suitabilityWarning.reasonCode, message: suitabilityWarning.message },
    );
  }

  const warning = getImageValidationWarning(result);

  if (warning) {
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

  const isFullOutfit = isVirtualTryOnFullOutfitProduct(product);

  return {
    productId: product._id,
    variantId: variant._id,
    colorVariantId: color._id,
    ...(normalizedSize ? { size: normalizedSize } : {}),
    role: isFullOutfit ? 'dress' : input.role,
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

  const productQuery = Product.find({ _id: { $in: productIds }, isActive: true });
  const products = await (typeof productQuery.populate === 'function'
    ? productQuery.populate('category_id', 'name')
    : productQuery);
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const fullOutfitProducts = items.filter((item) => {
    const product = productById.get(item.productId);
    return product ? isVirtualTryOnFullOutfitProduct(product) : false;
  });

  if (fullOutfitProducts.length && items.length > 1) {
    throw new VirtualTryOnServiceError(
      'Bộ đồ full set đã là một phối hoàn chỉnh. Hãy chọn riêng bộ đó hoặc bỏ các món khác.',
      400,
      'FULL_OUTFIT_EXCLUSIVE',
    );
  }

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

const throwActivePromptBlock = (
  violation: { violationCount?: number; blockedUntil?: Date | null },
  limit: number,
): never => {
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

const ensurePromptPolicyNotBlocked = async (
  userObjectId: Types.ObjectId,
  limit: number,
  now = new Date(),
) => {
  const activeBlock = await VirtualTryOnPromptViolation.findOne({
    userId: userObjectId,
    action: 'temporary_block',
    blockedUntil: { $gt: now },
  });

  if (activeBlock) {
    throwActivePromptBlock(activeBlock, limit);
  }
};

const normalizePromptForLog = (prompt?: string) => {
  const normalized = prompt?.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return (normalized || '(empty)').slice(0, 500);
};

const getEnabledPromptPolicyRules = async (): Promise<PromptPolicyRule[]> => {
  const rules = await VirtualTryOnPromptRule.find({
    enabled: true,
    deletedAt: null,
  }).sort({ updatedAt: -1 });

  return rules.map((rule) => ({
    key: `admin_rule_${rule._id.toString()}`,
    category: rule.category,
    reasonCode: rule.reasonCode,
    terms: [rule.term],
    foldVietnamese: true,
  }));
};

const validatePromptForCreateJob = async (
  userObjectId: Types.ObjectId,
  prompt: string | undefined,
  settings: VirtualTryOnRuntimeSettings,
) => {
  const now = new Date();
  const limit = settings.promptViolationLimitPerDay;
  await ensurePromptPolicyNotBlocked(userObjectId, limit, now);

  const promptValidation = validateVirtualTryOnPrompt(
    prompt,
    await getEnabledPromptPolicyRules(),
    settings.promptMaxLength,
  );
  if (promptValidation.allowed) return promptValidation;

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
    await notifyVirtualTryOnAccessBestEffort({
      userId: userObjectId.toString(),
      state: 'prompt_blocked',
      eventKey: `${userObjectId.toString()}:prompt:${start.toISOString()}`,
      blockedUntil,
      sendPush: false,
    });
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

const validateCreateJobInput = (
  input: CreateVirtualTryOnJobInput,
  settings: VirtualTryOnRuntimeSettings,
) => {
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
  const videoCapabilities = getVideoCapabilities(settings);
  if (outputMode === 'image_and_video' && !videoCapabilities.enabled) {
    throw new VirtualTryOnServiceError('Tạo video chưa được bật', 400, 'VIDEO_GENERATION_DISABLED');
  }
  if (outputMode === 'image_and_video' && !videoCapabilities.available) {
    throw new VirtualTryOnServiceError(
      'Cấu hình sinh video chưa sẵn sàng',
      503,
      videoCapabilities.reasonCode || 'VIDEO_PROVIDER_CONFIG_MISSING',
    );
  }
  const videoConfiguration = getVirtualTryOnVideoConfiguration({
    provider: settings.videoProvider,
    model: settings.videoModel,
    durationSeconds: settings.videoDurationSeconds,
    resolution: settings.videoResolution,
    aspectRatio: settings.videoAspectRatio,
    generateAudio: settings.videoGenerateAudio,
  });
  const videoDurationSeconds = input.videoDurationSeconds ?? videoConfiguration.durationSeconds;
  if (
    outputMode === 'image_and_video'
    && (
      !Number.isInteger(videoDurationSeconds)
      || videoDurationSeconds < videoConfiguration.minDurationSeconds
      || videoDurationSeconds > videoConfiguration.maxDurationSeconds
    )
  ) {
    throw new VirtualTryOnServiceError(
      `Thời lượng video phải từ ${videoConfiguration.minDurationSeconds} đến ${videoConfiguration.maxDurationSeconds} giây`,
      400,
      'VIDEO_DURATION_INVALID',
    );
  }

  return {
    contextPreset,
    outputMode,
    videoDurationSeconds: outputMode === 'image_and_video' ? videoDurationSeconds : null,
  };
};

const uploadAsset = async (userId: string, file: Express.Multer.File, source: UploadAssetSource) => {
  if (!file) {
    throw new VirtualTryOnServiceError('Ảnh là bắt buộc', 400);
  }

  const userObjectId = toObjectId(userId, 'user id');
  assertRuntimeEnabled(await virtualTryOnSettingsService.getRuntimeSettings());
  await ensureVirtualTryOnAccountEnabled(userObjectId);
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
    if (
      validationWarning &&
      isImageValidationSourceBlockReason(validationWarning.reasonCode)
    ) {
      throw new VirtualTryOnServiceError(
        validationWarning.message,
        getImageValidationReasonStatus(validationWarning.reasonCode),
        validationWarning.reasonCode,
        {
          reasonCode: validationWarning.reasonCode,
          message: validationWarning.message,
        },
      );
    }
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

  const cleanup = asset.type === 'generated_video'
    ? deleteFromCloudinary(asset.publicId, 'video')
    : deleteFromCloudinary(asset.publicId);
  cleanup.catch((error) => {
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

  assertRuntimeEnabled(await virtualTryOnSettingsService.getRuntimeSettings());
  await ensureVirtualTryOnAccountEnabled(toObjectId(userId, 'user id'));
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

const ensureVideoJobCapacity = async (
  userObjectId: Types.ObjectId,
  settings: VirtualTryOnRuntimeSettings,
) => {
  const { start, end } = getLocalDayRange();
  const [dailyCount, activeCount] = await Promise.all([
    VirtualTryOnJob.countDocuments({
      userId: userObjectId,
      deletedAt: null,
      outputMode: 'image_and_video',
      createdAt: { $gte: start, $lt: end },
    }),
    VirtualTryOnJob.countDocuments({
      userId: userObjectId,
      deletedAt: null,
      outputMode: 'image_and_video',
      videoStatus: { $in: ['queued', 'processing'] },
    }),
  ]);
  const maxPerDay = settings.maxVideoJobsPerUserPerDay;
  const maxConcurrent = settings.maxConcurrentVideoJobsPerUser;

  if (dailyCount >= maxPerDay) {
    throw new VirtualTryOnServiceError(
      `Bạn đã dùng hết ${maxPerDay} lượt sinh video hôm nay`,
      429,
      'VIDEO_DAILY_LIMIT_REACHED',
    );
  }
  if (activeCount >= maxConcurrent) {
    throw new VirtualTryOnServiceError(
      'Bạn đang có video khác được xử lý',
      409,
      'ACTIVE_VIDEO_JOB_EXISTS',
    );
  }
};

const createJob = async (
  userId: string,
  input: CreateVirtualTryOnJobInput,
  idempotencyKey?: string,
) => {
  const userObjectId = toObjectId(userId, 'user id');
  const runtimeSettings = await virtualTryOnSettingsService.getRuntimeSettings();
  const normalized = validateCreateJobInput(input, runtimeSettings);
  assertRuntimeEnabled(runtimeSettings);
  await ensureVirtualTryOnAccountEnabled(userObjectId);

  if (idempotencyKey) {
    const existing = await VirtualTryOnJob.findOne({
      userId: userObjectId,
      idempotencyKey,
      deletedAt: null,
    });
    if (existing) return serializeJob(existing);
  }

  const promptValidation = await validatePromptForCreateJob(
    userObjectId,
    input.contextPrompt,
    runtimeSettings,
  );
  if (normalized.outputMode === 'image_and_video') {
    await ensureVideoJobCapacity(userObjectId, runtimeSettings);
  }
  const activeJobCount = await getActiveJobCount(userId);
  const maxConcurrent = runtimeSettings.maxConcurrentJobsPerUser;
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
    videoDurationSeconds: normalized.videoDurationSeconds,
    status: 'queued',
    progress: 0,
    processingStage: 'queued',
    videoStatus: normalized.outputMode === 'image_and_video' ? 'queued' : 'not_requested',
    videoProgress: 0,
    videoProvider: normalized.outputMode === 'image_and_video'
      ? runtimeSettings.videoProvider
      : null,
    videoProviderMetadata: normalized.outputMode === 'image_and_video'
      ? {
        model: runtimeSettings.videoModel,
        durationSeconds: normalized.videoDurationSeconds,
        resolution: runtimeSettings.videoResolution,
        aspectRatio: runtimeSettings.videoAspectRatio,
        generateAudio: runtimeSettings.videoGenerateAudio,
        settingsVersion: runtimeSettings.version,
      }
      : {},
    provider: runtimeSettings.imageProvider,
    idempotencyKey: idempotencyKey || null,
    providerMetadata: {
      sourceImageProfile: buildSourceImageProfile(sourceImageValidationResult),
      model: runtimeSettings.imageModel,
      imageAspectRatio: runtimeSettings.imageAspectRatio,
      imageResolution: runtimeSettings.imageResolution,
      settingsVersion: runtimeSettings.version,
    },
  });

  emitJob(job, 'queued');
  await enqueueJob(job._id.toString());

  void Promise.all(
    selectedItems.map((item) =>
      interactionService.recordInteractionBestEffort(
        {
          userId,
          productId: item.productId.toString(),
          variantId: item.variantId.toString(),
          colorVariantId: item.colorVariantId.toString(),
          size: item.size,
          actionType: 'try_on',
          source: 'virtual_try_on',
          metadata: {
            virtualTryOnJobId: job._id.toString(),
            role: item.role,
            outfitMode: job.outfitMode,
            contextPreset: job.contextPreset,
          },
        },
        'Failed to record virtual try-on interaction',
      ),
    ),
  ).catch((error) => {
    console.warn('Failed to record virtual try-on interaction batch:', error);
  });

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
  const runtimeSettings = await virtualTryOnSettingsService.getRuntimeSettings();
  assertRuntimeEnabled(runtimeSettings);
  const userObjectId = toObjectId(userId, 'user id');
  await ensureVirtualTryOnAccountEnabled(userObjectId);
  const job = await VirtualTryOnJob.findOne({
    _id: toObjectId(jobId, 'job id'),
    userId: userObjectId,
    deletedAt: null,
    status: { $in: ['failed', 'canceled'] },
  });

  if (!job) {
    throw new VirtualTryOnServiceError('Chỉ có thể thử lại yêu cầu đã lỗi hoặc đã hủy', 400);
  }
  assertPolicyRetryAllowed(job.errorCode);

  if (job.outputMode === 'image_and_video' && !getVideoCapabilities(runtimeSettings).available) {
    throw new VirtualTryOnServiceError(
      'Tính năng sinh video chưa sẵn sàng',
      503,
      getVideoCapabilities(runtimeSettings).reasonCode || 'VIDEO_PROVIDER_CONFIG_MISSING',
    );
  }

  job.status = 'queued';
  job.progress = 0;
  job.processingStage = 'queued';
  job.generatedImageAssetId = null;
  job.generatedImageAssetIds = [];
  job.generatedImageUrls = [];
  job.generatedImageUrl = null;
  job.generatedVideoAssetId = null;
  job.generatedVideoUrl = null;
  job.videoStatus = job.outputMode === 'image_and_video' ? 'queued' : 'not_requested';
  job.videoProgress = 0;
  job.videoSourceImageAssetId = null;
  job.videoSourceImageUrlSnapshot = null;
  job.provider = runtimeSettings.imageProvider;
  job.providerMetadata = {
    sourceImageProfile: job.providerMetadata?.sourceImageProfile,
    model: runtimeSettings.imageModel,
    imageAspectRatio: runtimeSettings.imageAspectRatio,
    imageResolution: runtimeSettings.imageResolution,
    settingsVersion: runtimeSettings.version,
  };
  job.videoProvider = job.outputMode === 'image_and_video'
    ? runtimeSettings.videoProvider
    : null;
  job.videoProviderJobId = null;
  job.videoProviderMetadata = job.outputMode === 'image_and_video'
    ? {
      model: runtimeSettings.videoModel,
      durationSeconds: job.videoDurationSeconds ?? runtimeSettings.videoDurationSeconds,
      resolution: runtimeSettings.videoResolution,
      aspectRatio: runtimeSettings.videoAspectRatio,
      generateAudio: runtimeSettings.videoGenerateAudio,
      settingsVersion: runtimeSettings.version,
    }
    : {};
  job.videoErrorCode = null;
  job.videoErrorMessage = null;
  job.videoStartedAt = null;
  job.videoCompletedAt = null;
  job.errorCode = null;
  job.errorMessage = null;
  job.startedAt = null;
  job.completedAt = null;
  await job.save();

  emitJob(job, 'queued');
  await enqueueJob(job._id.toString());

  return serializeJob(job);
};

const retryVideoJobForFilter = async (
  filter: Record<string, unknown>,
  lockedAccountUserId?: Types.ObjectId,
) => {
  const runtimeSettings = await virtualTryOnSettingsService.getRuntimeSettings();
  assertRuntimeEnabled(runtimeSettings);
  if (lockedAccountUserId) {
    await ensureVirtualTryOnAccountEnabled(lockedAccountUserId);
  }
  const job = await VirtualTryOnJob.findOne({
    ...filter,
    deletedAt: null,
    outputMode: 'image_and_video',
    videoStatus: { $in: ['failed', 'canceled'] },
  });
  if (!job || getGeneratedImageUrls(job).length === 0) {
    throw new VirtualTryOnServiceError(
      'Chỉ có thể thử lại video đã lỗi hoặc đã hủy sau khi ảnh phối đồ hoàn tất',
      400,
      'VIDEO_RETRY_NOT_ALLOWED',
    );
  }
  assertPolicyRetryAllowed(job.videoErrorCode, 'video');

  const capabilities = getVideoCapabilities(runtimeSettings);
  if (!capabilities.available) {
    throw new VirtualTryOnServiceError(
      'Tính năng sinh video chưa sẵn sàng',
      503,
      capabilities.reasonCode || 'VIDEO_PROVIDER_CONFIG_MISSING',
    );
  }

  const activeVideoCount = await VirtualTryOnJob.countDocuments({
    _id: { $ne: job._id },
    userId: job.userId,
    deletedAt: null,
    videoStatus: { $in: ['queued', 'processing'] },
  });
  const maxConcurrent = runtimeSettings.maxConcurrentVideoJobsPerUser;
  if (activeVideoCount >= maxConcurrent) {
    throw new VirtualTryOnServiceError(
      'Tài khoản đang có video khác được xử lý',
      409,
      'ACTIVE_VIDEO_JOB_EXISTS',
    );
  }

  job.status = 'processing';
  job.progress = 70;
  job.processingStage = 'video_generation';
  job.generatedVideoAssetId = null;
  job.generatedVideoUrl = null;
  job.videoStatus = 'queued';
  job.videoProgress = 0;
  job.videoSourceImageAssetId = job.videoSourceImageAssetId || job.generatedImageAssetId || null;
  job.videoSourceImageUrlSnapshot = job.videoSourceImageUrlSnapshot || getGeneratedImageUrls(job)[0];
  job.videoProvider = runtimeSettings.videoProvider;
  job.videoProviderJobId = null;
  job.videoProviderMetadata = {
    model: runtimeSettings.videoModel,
    durationSeconds: job.videoDurationSeconds ?? runtimeSettings.videoDurationSeconds,
    resolution: runtimeSettings.videoResolution,
    aspectRatio: runtimeSettings.videoAspectRatio,
    generateAudio: runtimeSettings.videoGenerateAudio,
    settingsVersion: runtimeSettings.version,
  };
  job.videoErrorCode = null;
  job.videoErrorMessage = null;
  job.videoStartedAt = null;
  job.videoCompletedAt = null;
  job.completedAt = null;
  await job.save();

  emitJob(job, 'queued');
  await enqueueVideoJob(job._id.toString());
  return job;
};

const retryVideo = async (userId: string, jobId: string) => {
  const userObjectId = toObjectId(userId, 'user id');
  const job = await retryVideoJobForFilter({
    _id: toObjectId(jobId, 'job id'),
    userId: userObjectId,
  }, userObjectId);
  return serializeJob(job);
};

const cancelJob = async (userId: string, jobId: string) => {
  const jobObjectId = toObjectId(jobId, 'job id');
  const userObjectId = toObjectId(userId, 'user id');
  const activeJob = await VirtualTryOnJob.findOne({
    _id: jobObjectId,
    userId: userObjectId,
    deletedAt: null,
    status: { $in: ['queued', 'processing'] },
  });
  if (
    activeJob
    && activeJob.outputMode === 'image_and_video'
    && getGeneratedImageUrls(activeJob).length > 0
  ) {
    const videoCanceledJob = await VirtualTryOnJob.findOneAndUpdate(
      { _id: activeJob._id, status: { $in: ['queued', 'processing'] } },
      {
        status: 'succeeded',
        progress: 100,
        processingStage: 'completed',
        videoStatus: 'canceled',
        videoProgress: 100,
        videoCompletedAt: new Date(),
        completedAt: new Date(),
      },
      { returnDocument: 'after' },
    );
    if (videoCanceledJob) {
      await removeQueuedJobsBestEffort(jobId);
      emitJob(videoCanceledJob, 'canceled');
      return serializeJob(videoCanceledJob);
    }
  }

  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: jobObjectId,
      userId: userObjectId,
      deletedAt: null,
      status: { $in: ['queued', 'processing'] },
    },
    {
      status: 'canceled',
      progress: 100,
      processingStage: 'completed',
      videoStatus: activeJob?.outputMode === 'image_and_video' ? 'canceled' : 'not_requested',
      videoProgress: activeJob?.outputMode === 'image_and_video' ? 100 : 0,
      completedAt: new Date(),
    },
    { returnDocument: 'after' },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Không thể hủy yêu cầu này', 400);
  }

  await removeQueuedJobsBestEffort(jobId);
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
    { returnDocument: 'after' },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Yêu cầu phối đồ không tồn tại', 404);
  }

  await removeQueuedJobsBestEffort(jobId);
  await deleteVirtualTryOnJobNotifications(userId, jobId);

  return serializeJob(job);
};

type AdminJobListQuery = VirtualTryOnListQuery & {
  provider?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseAdminDate = (value: string, boundary: 'start' | 'end') => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnlyMatch
    ? new Date(`${value}T${boundary === 'end' ? '23:59:59.999' : '00:00:00.000'}+07:00`)
    : new Date(value);

  const normalizedVietnamDate = new Date(parsed.getTime() + VIETNAM_UTC_OFFSET_MS);
  const invalidDateOnly = dateOnlyMatch && (
    normalizedVietnamDate.getUTCFullYear() !== Number(dateOnlyMatch[1])
    || normalizedVietnamDate.getUTCMonth() + 1 !== Number(dateOnlyMatch[2])
    || normalizedVietnamDate.getUTCDate() !== Number(dateOnlyMatch[3])
  );

  if (Number.isNaN(parsed.getTime()) || invalidDateOnly) {
    throw new VirtualTryOnServiceError(
      boundary === 'start' ? 'Ngày bắt đầu không hợp lệ' : 'Ngày kết thúc không hợp lệ',
      400,
    );
  }
  return parsed;
};

const serializeAdminJob = async (job: IVirtualTryOnJob) => {
  const user = await User.findById(job.userId)
    .select('_id name email')
    .lean<{ _id: Types.ObjectId; name?: string; email?: string } | null>();
  const generatedImageUrls = getGeneratedImageUrls(job);
  const videoResult = getEffectiveVideoResult(job);

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
    videoDurationSeconds: job.videoDurationSeconds ?? null,
    provider: job.provider,
    imageModel: typeof job.providerMetadata?.model === 'string'
      ? job.providerMetadata.model
      : null,
    providerJobId: job.providerJobId,
    sourceImageUrl: job.sourceImageUrlSnapshot,
    processingStage: getEffectiveProcessingStage(job),
    selectedItemCount: job.selectedItems.length,
    selectedItems: job.selectedItems.map((item) => ({
      productId: item.productId.toString(),
      nameSnapshot: item.nameSnapshot,
      role: item.role,
      colorSnapshot: item.colorSnapshot,
      imageSnapshot: item.imageSnapshot,
      finalPriceSnapshot: item.finalPriceSnapshot,
    })),
    generatedImageUrl: generatedImageUrls[0] ?? null,
    generatedImageUrls,
    generatedVideoUrl: videoResult.url,
    videoStatus: videoResult.status,
    videoProgress: job.videoProgress ?? 0,
    videoSourceImageUrl: job.videoSourceImageUrlSnapshot ?? null,
    videoProvider: job.videoProvider ?? null,
    videoModel: typeof job.videoProviderMetadata?.model === 'string'
      ? job.videoProviderMetadata.model
      : null,
    videoProviderJobId: job.videoProviderJobId ?? null,
    videoErrorCode: videoResult.errorCode,
    videoErrorMessage: videoResult.errorMessage,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    totalFinalPrice: job.selectedItems.reduce((sum, item) => sum + item.finalPriceSnapshot, 0),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    videoStartedAt: job.videoStartedAt?.toISOString() ?? null,
    videoCompletedAt: job.videoCompletedAt?.toISOString() ?? null,
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
    createdAt.$gte = parseAdminDate(query.dateFrom, 'start');
  }
  if (query.dateTo) {
    createdAt.$lte = parseAdminDate(query.dateTo, 'end');
  }
  if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
    throw new VirtualTryOnServiceError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc', 400);
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
  const { start: dayStart, end: dayEnd } = getLocalDayRange(now);
  const todayFilter = { deletedAt: null, createdAt: { $gte: dayStart, $lt: dayEnd } };
  const runtimeSettings = await virtualTryOnSettingsService.getRuntimeSettings();
  const [
    total,
    today,
    queued,
    processing,
    succeeded,
    failed,
    canceled,
    todayQueued,
    todayProcessing,
    todaySucceeded,
    todayFailed,
    todayCanceled,
    videoRequested,
    videoProcessing,
    videoSucceeded,
    videoFailed,
    promptViolationsToday,
    promptBlocksToday,
    latestFailedJobs,
  ] = await Promise.all([
    VirtualTryOnJob.countDocuments({ deletedAt: null }),
    VirtualTryOnJob.countDocuments(todayFilter),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'queued' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'processing' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'succeeded' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'failed' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, status: 'canceled' }),
    VirtualTryOnJob.countDocuments({ ...todayFilter, status: 'queued' }),
    VirtualTryOnJob.countDocuments({ ...todayFilter, status: 'processing' }),
    VirtualTryOnJob.countDocuments({ ...todayFilter, status: 'succeeded' }),
    VirtualTryOnJob.countDocuments({ ...todayFilter, status: 'failed' }),
    VirtualTryOnJob.countDocuments({ ...todayFilter, status: 'canceled' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, outputMode: 'image_and_video' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, videoStatus: { $in: ['queued', 'processing'] } }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, videoStatus: 'succeeded' }),
    VirtualTryOnJob.countDocuments({ deletedAt: null, videoStatus: 'failed' }),
    VirtualTryOnPromptViolation.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
    VirtualTryOnPromptViolation.countDocuments({ action: 'temporary_block', createdAt: { $gte: dayStart, $lt: dayEnd } }),
    VirtualTryOnJob.find({ deletedAt: null, status: 'failed' }).sort({ updatedAt: -1 }).limit(5),
  ]);

  const finished = succeeded + failed;
  const todayFinished = todaySucceeded + todayFailed;

  return {
    total,
    today,
    queued,
    processing,
    succeeded,
    failed,
    canceled,
    todayQueued,
    todayProcessing,
    todaySucceeded,
    todayFailed,
    todayCanceled,
    successRate: finished ? Math.round((succeeded / finished) * 100) : 0,
    todaySuccessRate: todayFinished ? Math.round((todaySucceeded / todayFinished) * 100) : 0,
    provider: runtimeSettings.imageProvider,
    videoEnabled: runtimeSettings.enabled && getVideoCapabilities(runtimeSettings).available,
    videoRequested,
    videoProcessing,
    videoSucceeded,
    videoFailed,
    promptViolationsToday,
    promptBlocksToday,
    latestFailedJobs: await Promise.all(latestFailedJobs.map(serializeAdminJob)),
    generatedAt: now.toISOString(),
  };
};

const getAdminSettings = async () => {
  const [runtimeSettings, imageValidation] = await Promise.all([
    virtualTryOnSettingsService.getRuntimeSettings(),
    checkImageValidationProviderHealth(),
  ]);
  const configuredVideo = getVideoCapabilities(runtimeSettings);
  const imageEnabled = runtimeSettings.enabled && runtimeSettings.imageProvider !== 'disabled';
  const video = imageEnabled
    ? configuredVideo
    : {
      ...configuredVideo,
      available: false,
      reasonCode: 'VIRTUAL_TRY_ON_DISABLED',
    };
  return {
    provider: runtimeSettings.imageProvider,
    enabled: imageEnabled,
    runtimeEnabled: runtimeSettings.enabled,
    version: runtimeSettings.version,
    persisted: runtimeSettings.persisted,
    updatedAt: runtimeSettings.updatedAt?.toISOString() ?? null,
    historyVersions: runtimeSettings.historyVersions,
    modelOptions: virtualTryOnSettingsService.getModelOptions(runtimeSettings),
    secretStatus: virtualTryOnSettingsService.getSecretStatus(),
    imageValidation,
    image: {
      enabled: imageEnabled,
      provider: runtimeSettings.imageProvider,
      model: runtimeSettings.imageModel,
      aspectRatio: runtimeSettings.imageAspectRatio,
      resolution: runtimeSettings.imageResolution,
      outputCount: 4,
    },
    videoEnabled: video.available,
    video,
    maxSelectedItems: MAX_SELECTED_ITEMS,
    maxConcurrentJobsPerUser: runtimeSettings.maxConcurrentJobsPerUser,
    maxVideoJobsPerUserPerDay: runtimeSettings.maxVideoJobsPerUserPerDay,
    maxConcurrentVideoJobsPerUser: runtimeSettings.maxConcurrentVideoJobsPerUser,
    sourceImageMaxMb: 5,
    promptMaxLength: runtimeSettings.promptMaxLength,
    promptViolationLimitPerDay: runtimeSettings.promptViolationLimitPerDay,
  };
};

const testAdminPrompt = async (input: unknown) => {
  const contextPrompt = input && typeof input === 'object' && 'contextPrompt' in input
    ? (input as { contextPrompt?: unknown }).contextPrompt
    : undefined;
  const [settings, extraRules] = await Promise.all([
    virtualTryOnSettingsService.getRuntimeSettings(),
    getEnabledPromptPolicyRules(),
  ]);

  return validateVirtualTryOnPrompt(
    typeof contextPrompt === 'string' ? contextPrompt : undefined,
    extraRules,
    settings.promptMaxLength,
  );
};

const retryAdminJob = async (jobId: string) => {
  const runtimeSettings = await virtualTryOnSettingsService.getRuntimeSettings();
  assertRuntimeEnabled(runtimeSettings);
  const job = await VirtualTryOnJob.findOne({
    _id: toObjectId(jobId, 'job id'),
    deletedAt: null,
    status: { $in: ['failed', 'canceled'] },
  });

  if (!job) {
    throw new VirtualTryOnServiceError('Chỉ có thể thử lại job đã lỗi hoặc đã hủy', 400);
  }
  assertPolicyRetryAllowed(job.errorCode);

  if (job.outputMode === 'image_and_video' && !getVideoCapabilities(runtimeSettings).available) {
    throw new VirtualTryOnServiceError(
      'Tính năng sinh video chưa sẵn sàng',
      503,
      getVideoCapabilities(runtimeSettings).reasonCode || 'VIDEO_PROVIDER_CONFIG_MISSING',
    );
  }

  job.status = 'queued';
  job.progress = 0;
  job.processingStage = 'queued';
  job.generatedImageAssetId = null;
  job.generatedImageAssetIds = [];
  job.generatedImageUrls = [];
  job.generatedImageUrl = null;
  job.generatedVideoAssetId = null;
  job.generatedVideoUrl = null;
  job.videoStatus = job.outputMode === 'image_and_video' ? 'queued' : 'not_requested';
  job.videoProgress = 0;
  job.videoSourceImageAssetId = null;
  job.videoSourceImageUrlSnapshot = null;
  job.provider = runtimeSettings.imageProvider;
  job.providerMetadata = {
    sourceImageProfile: job.providerMetadata?.sourceImageProfile,
    model: runtimeSettings.imageModel,
    imageAspectRatio: runtimeSettings.imageAspectRatio,
    imageResolution: runtimeSettings.imageResolution,
    settingsVersion: runtimeSettings.version,
  };
  job.videoProvider = job.outputMode === 'image_and_video'
    ? runtimeSettings.videoProvider
    : null;
  job.videoProviderJobId = null;
  job.videoProviderMetadata = job.outputMode === 'image_and_video'
    ? {
      model: runtimeSettings.videoModel,
      durationSeconds: job.videoDurationSeconds ?? runtimeSettings.videoDurationSeconds,
      resolution: runtimeSettings.videoResolution,
      aspectRatio: runtimeSettings.videoAspectRatio,
      generateAudio: runtimeSettings.videoGenerateAudio,
      settingsVersion: runtimeSettings.version,
    }
    : {};
  job.videoErrorCode = null;
  job.videoErrorMessage = null;
  job.videoStartedAt = null;
  job.videoCompletedAt = null;
  job.errorCode = null;
  job.errorMessage = null;
  job.startedAt = null;
  job.completedAt = null;
  await job.save();

  emitJob(job, 'queued');
  await enqueueJob(job._id.toString());

  return serializeAdminJob(job);
};

const retryAdminVideo = async (jobId: string) => {
  const job = await retryVideoJobForFilter({
    _id: toObjectId(jobId, 'job id'),
  });
  return serializeAdminJob(job);
};

const cancelAdminJob = async (jobId: string) => {
  const jobObjectId = toObjectId(jobId, 'job id');
  const activeJob = await VirtualTryOnJob.findOne({
    _id: jobObjectId,
    deletedAt: null,
    status: { $in: ['queued', 'processing'] },
  });
  if (
    activeJob
    && activeJob.outputMode === 'image_and_video'
    && getGeneratedImageUrls(activeJob).length > 0
  ) {
    const videoCanceledJob = await VirtualTryOnJob.findOneAndUpdate(
      { _id: activeJob._id, status: { $in: ['queued', 'processing'] } },
      {
        status: 'succeeded',
        progress: 100,
        processingStage: 'completed',
        videoStatus: 'canceled',
        videoProgress: 100,
        videoCompletedAt: new Date(),
        completedAt: new Date(),
      },
      { returnDocument: 'after' },
    );
    if (videoCanceledJob) {
      await removeQueuedJobsBestEffort(jobId);
      emitJob(videoCanceledJob, 'canceled');
      await notifyVirtualTryOnOutcomeBestEffort({
        userId: videoCanceledJob.userId.toString(),
        jobId: videoCanceledJob._id.toString(),
        outcome: 'admin_canceled',
        outputMode: videoCanceledJob.outputMode,
        generatedImageCount: getGeneratedImageUrls(videoCanceledJob).length,
        imageUrl: getGeneratedImageUrls(videoCanceledJob)[0] ?? null,
        videoStatus: 'canceled',
        errorCode: 'ADMIN_CANCELED',
        retryable: true,
      });
      return serializeAdminJob(videoCanceledJob);
    }
  }

  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: jobObjectId,
      deletedAt: null,
      status: { $in: ['queued', 'processing'] },
    },
    {
      status: 'canceled',
      progress: 100,
      processingStage: 'completed',
      videoStatus: activeJob?.outputMode === 'image_and_video' ? 'canceled' : 'not_requested',
      videoProgress: activeJob?.outputMode === 'image_and_video' ? 100 : 0,
      completedAt: new Date(),
    },
    { returnDocument: 'after' },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Không thể hủy job này', 400);
  }

  await removeQueuedJobsBestEffort(jobId);
  emitJob(job, 'canceled');
  await notifyVirtualTryOnOutcomeBestEffort({
    userId: job.userId.toString(),
    jobId: job._id.toString(),
    outcome: 'admin_canceled',
    outputMode: job.outputMode,
    generatedImageCount: getGeneratedImageUrls(job).length,
    imageUrl: getGeneratedImageUrls(job)[0] ?? null,
    videoStatus: job.videoStatus,
    errorCode: 'ADMIN_CANCELED',
    retryable: true,
  });
  return serializeAdminJob(job);
};

const hideAdminJob = async (jobId: string) => {
  const job = await VirtualTryOnJob.findOneAndUpdate(
    {
      _id: toObjectId(jobId, 'job id'),
      deletedAt: null,
    },
    { deletedAt: new Date() },
    { returnDocument: 'after' },
  );

  if (!job) {
    throw new VirtualTryOnServiceError('Job phối đồ không tồn tại', 404);
  }

  await removeQueuedJobsBestEffort(jobId);
  return serializeAdminJob(job);
};

const listPromptRules = async (query: VirtualTryOnPromptRuleListQuery) => {
  const { page, limit } = clampPagination(query);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.category) filter.category = query.category;
  if (query.enabled !== undefined) filter.enabled = query.enabled;
  if (query.keyword) filter.term = new RegExp(escapeRegExp(query.keyword), 'i');

  const [totalItems, rules] = await Promise.all([
    VirtualTryOnPromptRule.countDocuments(filter),
    VirtualTryOnPromptRule.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    items: rules.map(serializePromptRule),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const createPromptRule = async (actorUserId: string | undefined, input: CreatePromptRuleInput) => {
  const term = normalizePromptRuleTerm(input?.term);
  const category = normalizePromptRuleCategory(input?.category);
  const reasonCode = getPromptRuleReasonCode(category, input?.reasonCode);
  const enabled = input?.enabled !== false;
  const actorObjectId = getActorObjectId(actorUserId);

  const existing = await VirtualTryOnPromptRule.findOne({
    term,
    deletedAt: { $ne: null },
  });
  if (existing) {
    existing.term = term;
    existing.category = category;
    existing.reasonCode = reasonCode;
    existing.enabled = enabled;
    existing.deletedAt = null;
    existing.updatedBy = actorObjectId;
    await existing.save();
    return serializePromptRule(existing);
  }

  try {
    const rule = await VirtualTryOnPromptRule.create({
      term,
      category,
      reasonCode,
      enabled,
      createdBy: actorObjectId,
      updatedBy: actorObjectId,
    });
    return serializePromptRule(rule);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      throw new VirtualTryOnServiceError('Cụm từ cần chặn đã tồn tại', 409);
    }
    throw error;
  }
};

const updatePromptRule = async (
  actorUserId: string | undefined,
  ruleId: string,
  input: UpdatePromptRuleInput,
) => {
  const rule = await VirtualTryOnPromptRule.findOne({
    _id: toObjectId(ruleId, 'rule id'),
    deletedAt: null,
  });

  if (!rule) {
    throw new VirtualTryOnServiceError('Quy tắc nội dung không tồn tại', 404);
  }

  const updates: Partial<IVirtualTryOnPromptRule> = {
    updatedBy: getActorObjectId(actorUserId),
  };

  if (input?.term !== undefined) updates.term = normalizePromptRuleTerm(input.term);
  if (input?.category !== undefined) updates.category = normalizePromptRuleCategory(input.category);
  if (input?.reasonCode !== undefined) {
    updates.reasonCode = getPromptRuleReasonCode(updates.category ?? rule.category, input.reasonCode);
  }
  if (input?.enabled !== undefined) updates.enabled = Boolean(input.enabled);

  try {
    Object.assign(rule, updates);
    await rule.save();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      throw new VirtualTryOnServiceError('Cụm từ cần chặn đã tồn tại', 409);
    }
    throw error;
  }

  return serializePromptRule(rule);
};

const deletePromptRule = async (actorUserId: string | undefined, ruleId: string) => {
  const rule = await VirtualTryOnPromptRule.findOneAndUpdate(
    { _id: toObjectId(ruleId, 'rule id'), deletedAt: null },
    { deletedAt: new Date(), updatedBy: getActorObjectId(actorUserId) },
    { returnDocument: 'after' },
  );

  if (!rule) {
    throw new VirtualTryOnServiceError('Quy tắc nội dung không tồn tại', 404);
  }

  return { _id: rule._id.toString(), deleted: true };
};

type AdminPromptViolationRecord = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  prompt: string;
  reasonCode: string;
  matchedCategory?: PromptPolicyCategory;
  action: 'warn' | 'temporary_block';
  violationCount: number;
  blockedUntil?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
};

const listPromptViolations = async (query: VirtualTryOnPromptViolationListQuery) => {
  const { page, limit } = clampPagination(query);
  const filter: Record<string, unknown> = {};

  if (query.category) {
    filter.matchedCategory = normalizePromptRuleCategory(query.category);
  }

  if (query.action) {
    if (query.action !== 'warn' && query.action !== 'temporary_block') {
      throw new VirtualTryOnServiceError('Mức xử lý không hợp lệ', 400);
    }
    filter.action = query.action;
  }

  const createdAt: Record<string, Date> = {};
  if (query.dateFrom) createdAt.$gte = parseAdminDate(query.dateFrom, 'start');
  if (query.dateTo) createdAt.$lte = parseAdminDate(query.dateTo, 'end');
  if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
    throw new VirtualTryOnServiceError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc', 400);
  }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  const keyword = query.keyword?.trim();
  if (keyword) {
    if (keyword.length > 100) {
      throw new VirtualTryOnServiceError('Từ khóa không được vượt quá 100 ký tự', 400);
    }

    const keywordRegex = new RegExp(escapeRegExp(keyword), 'i');
    const userConditions: Record<string, unknown>[] = [
      { name: keywordRegex },
      { email: keywordRegex },
    ];
    if (Types.ObjectId.isValid(keyword)) {
      userConditions.push({ _id: new Types.ObjectId(keyword) });
    }
    const matchedUsers = await User.find({ $or: userConditions })
      .select('_id')
      .lean<Array<{ _id: Types.ObjectId }>>();
    const keywordConditions: Record<string, unknown>[] = [
      { prompt: keywordRegex },
      { reasonCode: keywordRegex },
    ];
    if (Types.ObjectId.isValid(keyword)) {
      keywordConditions.push({ _id: new Types.ObjectId(keyword) });
    }
    if (matchedUsers.length) {
      keywordConditions.push({ userId: { $in: matchedUsers.map((user) => user._id) } });
    }
    filter.$or = keywordConditions;
  }

  const [totalItems, violations] = await Promise.all([
    VirtualTryOnPromptViolation.countDocuments(filter),
    VirtualTryOnPromptViolation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<AdminPromptViolationRecord[]>(),
  ]);

  const userIds = Array.from(new Set(violations.map((violation) => violation.userId.toString())));
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds.map((userId) => new Types.ObjectId(userId)) } })
      .select('_id name email')
      .lean<Array<{ _id: Types.ObjectId; name?: string; email?: string }>>()
    : [];
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const now = Date.now();

  return {
    items: violations.map((violation) => {
      const user = usersById.get(violation.userId.toString());
      return {
        _id: violation._id.toString(),
        user: user
          ? {
              _id: user._id.toString(),
              name: user.name ?? '',
              email: user.email ?? '',
            }
          : null,
        promptPreview: redactVirtualTryOnPromptForAdmin(
          violation.prompt,
          violation.matchedCategory,
        ),
        reasonCode: violation.reasonCode,
        matchedCategory: violation.matchedCategory ?? null,
        action: violation.action,
        violationCount: violation.violationCount,
        blockedUntil: violation.blockedUntil?.toISOString() ?? null,
        isActiveBlock: violation.action === 'temporary_block'
          && Boolean(violation.blockedUntil && violation.blockedUntil.getTime() > now),
        createdAt: violation.createdAt.toISOString(),
        expiresAt: violation.expiresAt?.toISOString() ?? null,
      };
    }),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const listAccountLocks = async (query: VirtualTryOnAccountLockListQuery) => {
  const { page, limit } = clampPagination(query);
  const filter: Record<string, unknown> = {};
  if (query.locked !== undefined) filter.isLocked = query.locked;
  if (query.keyword) {
    const keywordRegex = new RegExp(escapeRegExp(query.keyword), 'i');
    const userConditions: Record<string, unknown>[] = [
      { name: keywordRegex },
      { email: keywordRegex },
    ];
    if (Types.ObjectId.isValid(query.keyword)) {
      userConditions.push({ _id: new Types.ObjectId(query.keyword) });
    }
    const users = await User.find({
      $or: userConditions,
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();
    if (users.length === 0) {
      return {
        items: [],
        pagination: { page, limit, totalItems: 0, totalPages: 0 },
      };
    }
    filter.userId = { $in: users.map((u) => u._id) };
  }

  const [totalItems, locks] = await Promise.all([
    VirtualTryOnAccountLock.countDocuments(filter),
    VirtualTryOnAccountLock.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    items: await Promise.all(locks.map((lock) => serializeAccountLock(lock))),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const lockAccount = async (actorUserId: string | undefined, input: LockAccountInput) => {
  const user = await resolveUserForFeatureLock(input?.userId);
  const userId = user._id;
  if (typeof input?.reason !== 'string') {
    throw new VirtualTryOnServiceError('Lý do hạn chế không hợp lệ', 400);
  }
  const reason = input.reason.trim().slice(0, 240);
  if (reason.length < 3) {
    throw new VirtualTryOnServiceError('Vui lòng nhập lý do hạn chế từ 3 ký tự', 400);
  }
  const actorObjectId = getActorObjectId(actorUserId);

  const lock = await VirtualTryOnAccountLock.findOneAndUpdate(
    { userId },
    {
      isLocked: true,
      reason,
      lockedBy: actorObjectId,
      unlockedBy: null,
      unlockedAt: null,
      lockedAt: new Date(),
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await notifyVirtualTryOnAccessBestEffort({
    userId: userId.toString(),
    state: 'locked',
    eventKey: `${lock._id.toString()}:locked:${lock.lockedAt?.getTime() ?? Date.now()}`,
    sendPush: true,
  });

  return serializeAccountLock(lock);
};

const unlockAccount = async (actorUserId: string | undefined, userId: string) => {
  const userObjectId = toObjectId(userId, 'user id');
  const lock = await VirtualTryOnAccountLock.findOneAndUpdate(
    { userId: userObjectId, isLocked: true },
    {
      isLocked: false,
      reason: null,
      unlockedBy: getActorObjectId(actorUserId),
      unlockedAt: new Date(),
    },
    { returnDocument: 'after' },
  );

  if (!lock) {
    throw new VirtualTryOnServiceError('Khách hàng hiện không bị hạn chế phối đồ ảo', 404);
  }

  await notifyVirtualTryOnAccessBestEffort({
    userId: userObjectId.toString(),
    state: 'unlocked',
    eventKey: `${lock._id.toString()}:unlocked:${lock.unlockedAt?.getTime() ?? Date.now()}`,
    sendPush: true,
  });

  return serializeAccountLock(lock);
};

const getContextPresetPreviews = (): VirtualTryOnContextPresetPreview[] => contextPresetPreviews;

const getCapabilities = async () => {
  const [runtimeSettings, imageValidation] = await Promise.all([
    virtualTryOnSettingsService.getRuntimeSettings(),
    checkImageValidationProviderHealth(),
  ]);
  const imageCapabilities = getImageCapabilities(runtimeSettings);
  const imageAvailable = imageCapabilities.available;
  const video = getVideoCapabilities(runtimeSettings);
  return {
    imageGeneration: {
      ...imageCapabilities,
    },
    imageValidation,
    videoGeneration: imageAvailable
      ? video
      : {
        ...video,
        available: false,
        reasonCode: imageCapabilities.reasonCode,
      },
  };
};

const updateAdminSettings = async (
  input: { expectedVersion?: unknown; configuration?: unknown },
  actorId: string,
  actorRole: 'admin' | 'staff',
) => {
  await virtualTryOnSettingsService.updateSettings(input, { actorId, actorRole });
  return getAdminSettings();
};

const rollbackAdminSettings = async (
  input: { expectedVersion?: unknown; targetVersion?: unknown },
  actorId: string,
  actorRole: 'admin' | 'staff',
) => {
  await virtualTryOnSettingsService.rollbackSettings(input, { actorId, actorRole });
  return getAdminSettings();
};

export const processVirtualTryOnImageJob = runProviderJob;
export const processVirtualTryOnVideoJob = runVideoStage;

export const resumePendingVirtualTryOnJobs = async () => {
  const runtimeSettings = await virtualTryOnSettingsService.getRuntimeSettings();
  if (!runtimeSettings.enabled) return { image: 0, video: 0 };
  const jobs = await VirtualTryOnJob.find({
    deletedAt: null,
    status: { $in: ['queued', 'processing'] },
  }).select(
    '_id outputMode processingStage generatedImageUrl generatedImageUrls videoStatus',
  );

  const imageJobs: string[] = [];
  const videoJobs: string[] = [];
  const videoAvailable = getVideoCapabilities(runtimeSettings).available;
  for (const job of jobs) {
    const generatedImages = getGeneratedImageUrls(job);
    if (
      generatedImages.length > 0
      && job.outputMode === 'image_and_video'
      && videoAvailable
      && ['queued', 'processing'].includes(job.videoStatus)
    ) {
      videoJobs.push(job._id.toString());
    } else if (generatedImages.length === 0) {
      imageJobs.push(job._id.toString());
    }
  }

  await Promise.all([
    ...imageJobs.map((jobId) => enqueueJob(jobId)),
    ...videoJobs.map((jobId) => enqueueVideoJob(jobId)),
  ]);
  return { image: imageJobs.length, video: videoJobs.length };
};

export const resumePendingVirtualTryOnVideoJobs = async () =>
  (await resumePendingVirtualTryOnJobs()).video;

export const virtualTryOnService = {
  uploadAsset,
  listAssets,
  deleteAsset,
  validateAsset,
  createJob,
  getJob,
  getLatestJob,
  listJobs,
  getCapabilities,
  retryJob,
  retryVideo,
  cancelJob,
  deleteJob,
  listAdminJobs,
  getAdminSummary,
  getAdminSettings,
  updateAdminSettings,
  rollbackAdminSettings,
  testAdminPrompt,
  retryAdminJob,
  retryAdminVideo,
  cancelAdminJob,
  hideAdminJob,
  listPromptRules,
  createPromptRule,
  updatePromptRule,
  deletePromptRule,
  listPromptViolations,
  listAccountLocks,
  lockAccount,
  unlockAccount,
  getContextPresetPreviews,
};
