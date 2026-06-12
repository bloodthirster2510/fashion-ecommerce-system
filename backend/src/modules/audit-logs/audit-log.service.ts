import { Types } from 'mongoose';
import { AuditLog, type AuditLogAction } from '../../database/models';

type AuditActorRole = 'admin' | 'staff' | 'system';

type RecordAuditLogInput = {
  actorId?: string | null;
  actorRole: AuditActorRole;
  action: AuditLogAction;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

type ListAuditLogsInput = {
  targetType?: string;
  targetId?: string;
  action?: AuditLogAction;
  page?: number;
  limit?: number;
};

const toOptionalObjectId = (value?: string | null) => {
  if (!value || !Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

const toTargetId = (value: string) => (
  Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value
);

const recordAuditLog = async (input: RecordAuditLogInput) => {
  return AuditLog.create({
    actorId: toOptionalObjectId(input.actorId),
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId: toTargetId(input.targetId),
    reason: input.reason?.trim() || null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? {},
  });
};

const recordAuditLogBestEffort = async (input: RecordAuditLogInput) => {
  await recordAuditLog(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to record audit log:', message);
  });
};

const listAuditLogs = async ({
  targetType,
  targetId,
  action,
  page = 1,
  limit = 20,
}: ListAuditLogsInput) => {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(Math.max(1, limit), 100);
  const filter: Record<string, unknown> = {};

  if (targetType?.trim()) {
    filter.targetType = targetType.trim();
  }

  if (targetId?.trim()) {
    filter.targetId = toTargetId(targetId.trim());
  }

  if (action) {
    filter.action = action;
  }

  const [items, totalItems] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / normalizedLimit),
    },
  };
};

export const auditLogService = {
  listAuditLogs,
  recordAuditLog,
  recordAuditLogBestEffort,
};
