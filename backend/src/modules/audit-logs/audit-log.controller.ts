import type { Request, Response } from 'express';
import { error, ok } from '../../utils/response';
import { auditLogService } from './audit-log.service';
import type { AuditLogAction } from '../../database/models';

const AUDIT_LOG_ACTIONS: AuditLogAction[] = [
  'order.status_update',
  'order.shipping_update',
  'order.shipping_webhook',
  'payment.adjust',
  'payment.expire',
  'payment_method.status_update',
];

const parseString = (value: unknown) => {
  if (Array.isArray(value)) return parseString(value[0]);
  if (typeof value !== 'string') return undefined;
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
};

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsedValue = Number(parseString(value));
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const parseAction = (value: unknown) => {
  const action = parseString(value);
  if (!action) return undefined;
  return AUDIT_LOG_ACTIONS.includes(action as AuditLogAction)
    ? action as AuditLogAction
    : null;
};

export const listAuditLogs = async (req: Request, res: Response) => {
  try {
    const action = parseAction(req.query.action);

    if (action === null) {
      return error(res, 'Invalid audit action', 400);
    }

    const result = await auditLogService.listAuditLogs({
      targetType: parseString(req.query.targetType),
      targetId: parseString(req.query.targetId),
      action,
      page: parsePositiveInteger(req.query.page, 1),
      limit: parsePositiveInteger(req.query.limit, 20),
    });

    return ok(res, result);
  } catch (err: unknown) {
    return error(res, err instanceof Error ? err.message : 'Cannot list audit logs', 500);
  }
};
