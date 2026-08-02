import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import {
  CustomerNotificationServiceError,
  customerNotificationService,
} from './customer-notification.service';
import { pushNotificationService } from './push-notification.service';

const parseString = (value: unknown) => {
  if (Array.isArray(value)) return parseString(value[0]);
  return typeof value === 'string' ? value.trim() || undefined : undefined;
};

const parseNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(parseString(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoolean = (value: unknown) => ['true', '1'].includes(parseString(value)?.toLowerCase() ?? '');

const respondWithError = (res: Response, error: unknown) => {
  if (error instanceof CustomerNotificationServiceError) {
    return errorResponse(res, error.message, error.statusCode);
  }
  const statusCode = error && typeof error === 'object' && 'statusCode' in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : 500;
  if (statusCode >= 400 && statusCode < 500 && error instanceof Error) {
    return errorResponse(res, error.message, statusCode);
  }
  console.error('Customer notification controller error:', error);
  return errorResponse(res, 'Unable to process notifications', 500);
};

export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) return errorResponse(res, 'Authentication required', 401);
    return ok(res, await customerNotificationService.list({
      userId: req.user.userId,
      limit: parseNumber(req.query.limit),
      cursor: parseString(req.query.cursor),
      category: parseString(req.query.category),
      unreadOnly: parseBoolean(req.query.unreadOnly),
    }));
  } catch (error) {
    return respondWithError(res, error);
  }
};

export const markMyNotificationRead = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) return errorResponse(res, 'Authentication required', 401);
    const notificationId = parseString(req.params.id);
    if (!notificationId) return errorResponse(res, 'notificationId is required', 400);
    return ok(res, await customerNotificationService.markRead(req.user.userId, notificationId));
  } catch (error) {
    return respondWithError(res, error);
  }
};

export const markAllMyNotificationsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) return errorResponse(res, 'Authentication required', 401);
    return ok(res, await customerNotificationService.markAllRead(req.user.userId));
  } catch (error) {
    return respondWithError(res, error);
  }
};

export const registerMyPushToken = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) return errorResponse(res, 'Authentication required', 401);
    return ok(res, await pushNotificationService.registerPushToken(req.user.userId, req.body));
  } catch (error) {
    const statusCode = error && typeof error === 'object' && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 400
      : 500;
    return errorResponse(
      res,
      error instanceof Error ? error.message : 'Unable to register push token',
      statusCode,
    );
  }
};

export const unregisterMyPushToken = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) return errorResponse(res, 'Authentication required', 401);
    return ok(
      res,
      await pushNotificationService.unregisterPushToken(
        req.user.userId,
        parseString(req.body?.token) ?? '',
      ),
    );
  } catch (error) {
    return respondWithError(res, error);
  }
};
