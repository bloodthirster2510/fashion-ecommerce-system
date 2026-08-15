import { Types } from 'mongoose';
import {
  VirtualTryOnSettings,
  type IVirtualTryOnRuntimeConfiguration,
} from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';
import { PROMPT_MAX_LENGTH } from './prompt-policy/prompt-policy.service';

export type VirtualTryOnRuntimeSettings = IVirtualTryOnRuntimeConfiguration & {
  version: number;
  persisted: boolean;
  updatedAt: Date | null;
  historyVersions: number[];
};

type SettingsActor = {
  actorId: string;
  actorRole: 'admin' | 'staff';
};

export class VirtualTryOnSettingsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'VirtualTryOnSettingsServiceError';
  }
}

const SETTINGS_KEY = 'virtual_try_on';

const normalizeImageProvider = (value: unknown): IVirtualTryOnRuntimeConfiguration['imageProvider'] => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/^\/+/, '');
  if (!normalized) return 'mock';
  if (normalized === 'mock' || normalized === 'disabled') return normalized;
  if (['comfy', 'comfyui', 'fashionshop-tryon'].includes(normalized)) return 'comfy';
  return 'disabled';
};

const normalizeVideoProvider = (value: unknown): IVirtualTryOnRuntimeConfiguration['videoProvider'] => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/^\/+/, '');
  if (normalized === 'mock' || normalized === 'disabled') return normalized;
  if (['comfy-kling', 'comfy_kling', 'kling'].includes(normalized)) return 'comfy_kling';
  return 'comfy_kling';
};

const getDefaultImageModel = () =>
  process.env.VIRTUAL_TRY_ON_COMFY_MODEL?.trim() || 'workflow_default';

const getDefaultVideoModel = () =>
  process.env.VIRTUAL_TRY_ON_VIDEO_MODEL?.trim() || 'kling-v3-omni';

const normalizeStoredModel = (value: unknown, fallback: string) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
};

const positiveEnv = (key: string, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(process.env[key]);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const getDefaultConfiguration = (): IVirtualTryOnRuntimeConfiguration => ({
  enabled: process.env.VIRTUAL_TRY_ON_PROVIDER?.trim() !== 'disabled',
  imageProvider: normalizeImageProvider(process.env.VIRTUAL_TRY_ON_PROVIDER),
  imageModel: normalizeImageProvider(process.env.VIRTUAL_TRY_ON_PROVIDER) === 'mock'
    ? 'mock'
    : getDefaultImageModel(),
  videoProvider: normalizeVideoProvider(process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER),
  videoModel: normalizeVideoProvider(process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER) === 'mock'
    ? 'mock'
    : getDefaultVideoModel(),
  maxConcurrentJobsPerUser: positiveEnv(
    'VIRTUAL_TRY_ON_MAX_CONCURRENT_JOBS_PER_USER',
    1,
    1,
    10,
  ),
  maxVideoJobsPerUserPerDay: positiveEnv(
    'VIRTUAL_TRY_ON_MAX_VIDEO_JOBS_PER_USER_PER_DAY',
    3,
    1,
    50,
  ),
  maxConcurrentVideoJobsPerUser: positiveEnv(
    'VIRTUAL_TRY_ON_MAX_CONCURRENT_VIDEO_JOBS_PER_USER',
    1,
    1,
    5,
  ),
  promptMaxLength: Math.min(500, Math.max(50, Math.floor(PROMPT_MAX_LENGTH))),
  promptViolationLimitPerDay: positiveEnv(
    'VIRTUAL_TRY_ON_PROMPT_VIOLATION_LIMIT_PER_DAY',
    5,
    1,
    20,
  ),
});

const toConfiguration = (
  value: Partial<IVirtualTryOnRuntimeConfiguration>,
): IVirtualTryOnRuntimeConfiguration => ({
  enabled: value.enabled === true,
  imageProvider: normalizeImageProvider(value.imageProvider ?? process.env.VIRTUAL_TRY_ON_PROVIDER),
  imageModel: normalizeStoredModel(
    value.imageModel,
    normalizeImageProvider(value.imageProvider ?? process.env.VIRTUAL_TRY_ON_PROVIDER) === 'mock'
      ? 'mock'
      : getDefaultImageModel(),
  ),
  videoProvider: normalizeVideoProvider(value.videoProvider ?? process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER),
  videoModel: normalizeStoredModel(
    value.videoModel,
    normalizeVideoProvider(value.videoProvider ?? process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER) === 'mock'
      ? 'mock'
      : getDefaultVideoModel(),
  ),
  maxConcurrentJobsPerUser: Number(value.maxConcurrentJobsPerUser),
  maxVideoJobsPerUserPerDay: Number(value.maxVideoJobsPerUserPerDay),
  maxConcurrentVideoJobsPerUser: Number(value.maxConcurrentVideoJobsPerUser),
  promptMaxLength: Number(value.promptMaxLength),
  promptViolationLimitPerDay: Number(value.promptViolationLimitPerDay),
});

const toAuditSnapshot = (
  value: IVirtualTryOnRuntimeConfiguration,
): Record<string, unknown> => ({
  enabled: value.enabled,
  imageProvider: value.imageProvider,
  imageModel: value.imageModel,
  videoProvider: value.videoProvider,
  videoModel: value.videoModel,
  maxConcurrentJobsPerUser: value.maxConcurrentJobsPerUser,
  maxVideoJobsPerUserPerDay: value.maxVideoJobsPerUserPerDay,
  maxConcurrentVideoJobsPerUser: value.maxConcurrentVideoJobsPerUser,
  promptMaxLength: value.promptMaxLength,
  promptViolationLimitPerDay: value.promptViolationLimitPerDay,
});

const serialize = (
  value: Partial<IVirtualTryOnRuntimeConfiguration> & {
    version?: number;
    history?: Array<{ version: number }>;
    updatedAt?: Date | null;
  },
  persisted: boolean,
): VirtualTryOnRuntimeSettings => ({
  ...toConfiguration(value),
  version: value.version ?? 0,
  persisted,
  updatedAt: value.updatedAt ?? null,
  historyVersions: (value.history ?? [])
    .map((item) => item.version)
    .sort((first, second) => second - first),
});

const parseExpectedVersion = (value: unknown) => {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new VirtualTryOnSettingsServiceError('Phiên bản cấu hình không hợp lệ', 400);
  }
  return Number(value);
};

const parseInteger = (
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number,
) => {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new VirtualTryOnSettingsServiceError(
      `${fieldName} phải từ ${minimum} đến ${maximum}`,
      400,
    );
  }
  return Number(value);
};

const parseProvider = <T extends string>(
  value: unknown,
  fieldName: string,
  supported: readonly T[],
) => {
  if (typeof value !== 'string' || !supported.includes(value.trim() as T)) {
    throw new VirtualTryOnSettingsServiceError(`${fieldName} không được hỗ trợ`, 400);
  }
  return value.trim() as T;
};

const parseModel = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string') {
    throw new VirtualTryOnSettingsServiceError(`${fieldName} không hợp lệ`, 400);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new VirtualTryOnSettingsServiceError(
      `${fieldName} phải từ 1 đến 120 ký tự`,
      400,
    );
  }
  return normalized;
};

const requireInputRecord = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VirtualTryOnSettingsServiceError('Dữ liệu cấu hình không hợp lệ', 400);
  }
  return value as Record<string, unknown>;
};

const normalizeConfiguration = (value: unknown): IVirtualTryOnRuntimeConfiguration => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VirtualTryOnSettingsServiceError('Cấu hình không hợp lệ', 400);
  }
  const input = value as Record<string, unknown>;
  if (typeof input.enabled !== 'boolean') {
    throw new VirtualTryOnSettingsServiceError('Trạng thái tính năng không hợp lệ', 400);
  }

  return {
    enabled: input.enabled,
    imageProvider: parseProvider(
      input.imageProvider,
      'Provider tạo ảnh',
      ['mock', 'comfy', 'disabled'] as const,
    ),
    imageModel: parseModel(input.imageModel, 'Model tạo ảnh'),
    videoProvider: parseProvider(
      input.videoProvider,
      'Provider tạo video',
      ['mock', 'comfy_kling', 'disabled'] as const,
    ),
    videoModel: parseModel(input.videoModel, 'Model tạo video'),
    maxConcurrentJobsPerUser: parseInteger(
      input.maxConcurrentJobsPerUser,
      'Job ảnh đồng thời/user',
      1,
      10,
    ),
    maxVideoJobsPerUserPerDay: parseInteger(
      input.maxVideoJobsPerUserPerDay,
      'Video/user/ngày',
      1,
      50,
    ),
    maxConcurrentVideoJobsPerUser: parseInteger(
      input.maxConcurrentVideoJobsPerUser,
      'Video đồng thời/user',
      1,
      5,
    ),
    promptMaxLength: parseInteger(
      input.promptMaxLength,
      'Độ dài prompt tối đa',
      50,
      500,
    ),
    promptViolationLimitPerDay: parseInteger(
      input.promptViolationLimitPerDay,
      'Ngưỡng vi phạm prompt',
      1,
      20,
    ),
  };
};

const validateActor = (actorId: string) => {
  if (!Types.ObjectId.isValid(actorId)) {
    throw new VirtualTryOnSettingsServiceError('Tài khoản quản trị không hợp lệ', 401);
  }
  return new Types.ObjectId(actorId);
};

const getRuntimeSettings = async (): Promise<VirtualTryOnRuntimeSettings> => {
  const settings = await VirtualTryOnSettings.findOne({ key: SETTINGS_KEY }).lean();
  if (!settings) {
    return serialize(getDefaultConfiguration(), false);
  }
  return serialize(settings, true);
};

const updateSettings = async (
  input: unknown,
  actor: SettingsActor,
) => {
  const payload = requireInputRecord(input);
  const expectedVersion = parseExpectedVersion(payload.expectedVersion);
  const configuration = normalizeConfiguration(payload.configuration);
  const updatedBy = validateActor(actor.actorId);
  const current = await VirtualTryOnSettings.findOne({ key: SETTINGS_KEY }).lean();

  if (!current) {
    if (expectedVersion !== 0) {
      throw new VirtualTryOnSettingsServiceError(
        'Cấu hình đã thay đổi ở phiên khác. Vui lòng tải lại.',
        409,
      );
    }

    try {
      const created = await VirtualTryOnSettings.create({
        key: SETTINGS_KEY,
        ...configuration,
        version: 1,
        history: [],
        updatedBy,
      });
      await auditLogService.recordAuditLogBestEffort({
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'virtual_try_on.settings_update',
        targetType: 'VirtualTryOnSettings',
        targetId: SETTINGS_KEY,
        before: toAuditSnapshot(getDefaultConfiguration()),
        after: toAuditSnapshot(configuration),
        metadata: { fromVersion: 0, toVersion: 1 },
      });
      return serialize(
        created.toObject() as unknown as IVirtualTryOnRuntimeConfiguration & {
          version: number;
          history: Array<{ version: number }>;
          updatedAt: Date;
        },
        true,
      );
    } catch (caughtError) {
      if ((caughtError as { code?: number })?.code === 11000) {
        throw new VirtualTryOnSettingsServiceError(
          'Cấu hình đã thay đổi ở phiên khác. Vui lòng tải lại.',
          409,
        );
      }
      throw caughtError;
    }
  }

  const currentConfiguration = toConfiguration(current);
  const updated = await VirtualTryOnSettings.findOneAndUpdate(
    { key: SETTINGS_KEY, version: expectedVersion },
    {
      $set: { ...configuration, updatedBy },
      $inc: { version: 1 },
      $push: {
        history: {
          $each: [{
            version: current.version,
            configuration: currentConfiguration,
            changedBy: current.updatedBy ?? null,
            changedAt: current.updatedAt,
          }],
          $slice: -20,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!updated) {
    throw new VirtualTryOnSettingsServiceError(
      'Cấu hình đã thay đổi ở phiên khác. Vui lòng tải lại.',
      409,
    );
  }

  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'virtual_try_on.settings_update',
    targetType: 'VirtualTryOnSettings',
    targetId: SETTINGS_KEY,
    before: toAuditSnapshot(currentConfiguration),
    after: toAuditSnapshot(configuration),
    metadata: { fromVersion: current.version, toVersion: updated.version },
  });
  return serialize(updated, true);
};

const rollbackSettings = async (
  input: unknown,
  actor: SettingsActor,
) => {
  const payload = requireInputRecord(input);
  const expectedVersion = parseExpectedVersion(payload.expectedVersion);
  const targetVersion = parseExpectedVersion(payload.targetVersion);
  const updatedBy = validateActor(actor.actorId);
  const current = await VirtualTryOnSettings.findOne({ key: SETTINGS_KEY }).lean();

  if (!current || current.version !== expectedVersion) {
    throw new VirtualTryOnSettingsServiceError(
      'Cấu hình đã thay đổi ở phiên khác. Vui lòng tải lại.',
      409,
    );
  }
  if (targetVersion === current.version) {
    throw new VirtualTryOnSettingsServiceError('Cấu hình đang ở phiên bản này', 400);
  }

  const target = current.history.find((item: { version: number }) => item.version === targetVersion);
  if (!target) {
    throw new VirtualTryOnSettingsServiceError(
      'Không còn snapshot cho phiên bản cần khôi phục',
      404,
    );
  }

  const currentConfiguration = toConfiguration(current);
  const targetConfiguration = toConfiguration(target.configuration);
  const updated = await VirtualTryOnSettings.findOneAndUpdate(
    { key: SETTINGS_KEY, version: expectedVersion },
    {
      $set: { ...targetConfiguration, updatedBy },
      $inc: { version: 1 },
      $push: {
        history: {
          $each: [{
            version: current.version,
            configuration: currentConfiguration,
            changedBy: current.updatedBy ?? null,
            changedAt: current.updatedAt,
          }],
          $slice: -20,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!updated) {
    throw new VirtualTryOnSettingsServiceError(
      'Cấu hình đã thay đổi ở phiên khác. Vui lòng tải lại.',
      409,
    );
  }

  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'virtual_try_on.settings_rollback',
    targetType: 'VirtualTryOnSettings',
    targetId: SETTINGS_KEY,
    before: toAuditSnapshot(currentConfiguration),
    after: toAuditSnapshot(targetConfiguration),
    metadata: {
      fromVersion: current.version,
      targetVersion,
      toVersion: updated.version,
    },
  });
  return serialize(updated, true);
};

const getSecretStatus = () => ({
  providerApiKeyConfigured: Boolean(process.env.VIRTUAL_TRY_ON_API_KEY?.trim()),
  imageEndpointConfigured: Boolean(
    process.env.VIRTUAL_TRY_ON_COMFY_BASE_URL?.trim() ||
    process.env.VIRTUAL_TRY_ON_SERVICE_URL?.trim(),
  ),
  videoWorkflowConfigured: Boolean(
    process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH?.trim() &&
    process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH?.trim(),
  ),
});

const parseModelOptions = (value: string | undefined, current: string) => Array.from(new Set([
  current,
  ...(value ?? '').split(',').map((item) => item.trim()).filter(Boolean),
]));

const getModelOptions = (settings: IVirtualTryOnRuntimeConfiguration) => ({
  imageProviders: ['comfy', 'mock', 'disabled'] as const,
  videoProviders: ['comfy_kling', 'mock', 'disabled'] as const,
  imageModels: parseModelOptions(
    process.env.VIRTUAL_TRY_ON_ALLOWED_IMAGE_MODELS,
    settings.imageModel,
  ),
  videoModels: parseModelOptions(
    process.env.VIRTUAL_TRY_ON_ALLOWED_VIDEO_MODELS,
    settings.videoModel,
  ),
});

export const virtualTryOnSettingsService = {
  getRuntimeSettings,
  getModelOptions,
  getSecretStatus,
  rollbackSettings,
  updateSettings,
};
