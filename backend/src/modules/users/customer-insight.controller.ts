import type { Request, Response } from 'express';
import { error, ok } from '../../utils/response';
import {
  CustomerInsightServiceError,
  customerInsightService,
} from './customer-insight.service';

const parseString = (value: unknown) => {
  if (Array.isArray(value)) return parseString(value[0]);
  if (typeof value !== 'string') return undefined;
  return value.trim() || undefined;
};

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(parseString(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getParam = (value: unknown) => parseString(value) ?? '';

const getErrorResponse = (caughtError: unknown) => {
  if (caughtError instanceof CustomerInsightServiceError) {
    return {
      statusCode: caughtError.statusCode,
      message: caughtError.message,
    };
  }

  console.error('Customer insight controller error:', caughtError);
  return {
    statusCode: 500,
    message: 'Không thể xử lý dữ liệu khách hàng',
  };
};

export const getCustomerInsights = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await customerInsightService.getCustomerInsights({
        customerId: getParam(req.params.id),
        activityPage: parsePositiveInteger(req.query.activityPage),
        activityLimit: parsePositiveInteger(req.query.activityLimit),
      }),
    );
  } catch (caughtError) {
    const { statusCode, message } = getErrorResponse(caughtError);
    return error(res, message, statusCode);
  }
};

export const listCustomerNotes = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await customerInsightService.listCustomerNotes({
        customerId: getParam(req.params.id),
        limit: parsePositiveInteger(req.query.limit),
      }),
    );
  } catch (caughtError) {
    const { statusCode, message } = getErrorResponse(caughtError);
    return error(res, message, statusCode);
  }
};

export const createCustomerNote = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await customerInsightService.createCustomerNote({
        customerId: getParam(req.params.id),
        content: req.body?.content,
        actorId: req.user!.userId,
        actorRole: req.user!.role as 'admin' | 'staff',
      }),
      'Đã thêm ghi chú',
    );
  } catch (caughtError) {
    const { statusCode, message } = getErrorResponse(caughtError);
    return error(res, message, statusCode);
  }
};

export const updateCustomerNote = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await customerInsightService.updateCustomerNote({
        customerId: getParam(req.params.id),
        noteId: getParam(req.params.noteId),
        content: req.body?.content,
        actorId: req.user!.userId,
        actorRole: req.user!.role as 'admin' | 'staff',
      }),
      'Đã cập nhật ghi chú',
    );
  } catch (caughtError) {
    const { statusCode, message } = getErrorResponse(caughtError);
    return error(res, message, statusCode);
  }
};

export const deleteCustomerNote = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await customerInsightService.deleteCustomerNote({
        customerId: getParam(req.params.id),
        noteId: getParam(req.params.noteId),
        actorId: req.user!.userId,
        actorRole: req.user!.role as 'admin' | 'staff',
      }),
      'Đã xóa ghi chú',
    );
  } catch (caughtError) {
    const { statusCode, message } = getErrorResponse(caughtError);
    return error(res, message, statusCode);
  }
};
