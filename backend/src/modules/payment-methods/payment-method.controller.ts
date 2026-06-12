import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import { auditLogService } from '../audit-logs/audit-log.service';
import { SalesServiceError } from '../sales/sales.helpers';
import { paymentMethodService } from './payment-method.service';
import type { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './payment-method.types';
import type { PaymentMethodStatus } from '../../database/models';

const PAYMENT_METHOD_STATUSES: PaymentMethodStatus[] = ['pending', 'verified', 'expired', 'disabled'];

const getErrorResponse = (error: unknown) => {
  if (error instanceof SalesServiceError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  return {
    statusCode: 500,
    message: error instanceof Error ? error.message : 'Internal Server Error',
  };
};

const getUserId = (req: Request) => req.user!.userId;

const parseAdminReason = (value: unknown) => {
  const reason = typeof value === 'string' ? value.trim() : '';

  if (reason.length < 5) {
    throw new SalesServiceError('Reason is required and must be at least 5 characters', 400);
  }

  return reason;
};

const parsePaymentMethodStatus = (value: unknown) => {
  const status = typeof value === 'string' ? value : '';

  if (!PAYMENT_METHOD_STATUSES.includes(status as PaymentMethodStatus)) {
    throw new SalesServiceError('Invalid payment method status', 400);
  }

  return status as PaymentMethodStatus;
};

export const listPaymentMethods = async (req: Request, res: Response) => {
  try {
    const methods = await paymentMethodService.listPaymentMethods(getUserId(req));
    return ok(res, methods);
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const createPaymentMethod = async (req: Request, res: Response) => {
  try {
    const method = await paymentMethodService.createPaymentMethod(
      getUserId(req),
      req.body as CreatePaymentMethodInput,
    );
    return ok(res, method, 'Created payment method');
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const updatePaymentMethod = async (req: Request, res: Response) => {
  try {
    const method = await paymentMethodService.updatePaymentMethod(
      getUserId(req),
      req.params.id as string,
      req.body as UpdatePaymentMethodInput,
    );
    return ok(res, method);
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const setDefaultPaymentMethod = async (req: Request, res: Response) => {
  try {
    const method = await paymentMethodService.setDefaultPaymentMethod(
      getUserId(req),
      req.params.id as string,
    );
    return ok(res, method);
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const method = await paymentMethodService.disablePaymentMethod(
      getUserId(req),
      req.params.id as string,
    );
    return ok(res, method);
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const adminListUserPaymentMethods = async (req: Request, res: Response) => {
  try {
    const methods = await paymentMethodService.listUserPaymentMethodsForAdmin(req.params.userId as string);
    return ok(res, methods);
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const adminUpdatePaymentMethodStatus = async (req: Request, res: Response) => {
  try {
    const status = parsePaymentMethodStatus((req.body as { status?: unknown }).status);
    const reason = parseAdminReason((req.body as { reason?: unknown }).reason);
    const result = await paymentMethodService.updatePaymentMethodStatusForAdmin({
      id: req.params.id as string,
      status,
    });

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'payment_method.status_update',
      targetType: 'PaymentMethod',
      targetId: req.params.id as string,
      reason,
      before: result.before,
      after: result.after,
      metadata: {
        userId: result.method.user_id.toString(),
      },
    });

    return ok(res, result.method);
  } catch (error: unknown) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};
