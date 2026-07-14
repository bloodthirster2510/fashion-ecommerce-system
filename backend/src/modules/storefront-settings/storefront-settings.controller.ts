import type { Request, Response } from 'express';
import { auditLogService } from '../audit-logs/audit-log.service';
import { error, ok } from '../../utils/response';
import {
  StorefrontSettingsServiceError,
  storefrontSettingsService,
  type StorefrontSettingsInput,
} from './storefront-settings.service';

const handleError = (res: Response, caught: unknown) => {
  if (caught instanceof StorefrontSettingsServiceError) {
    return error(res, caught.message, caught.statusCode);
  }
  console.error('Storefront settings request failed:', caught);
  return error(res, 'Không thể xử lý cấu hình cửa hàng', 500);
};

export const getPublicStorefrontSettings = async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    return ok(res, await storefrontSettingsService.getPublicSettings());
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const getAdminStorefrontSettings = async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store');
    return ok(res, await storefrontSettingsService.getAdminSettings());
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const updateAdminStorefrontSettings = async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId || req.user.role !== 'admin') {
      return error(res, 'Authentication required', 401);
    }

    const before = await storefrontSettingsService.getAdminSettings();
    const settings = await storefrontSettingsService.updateSettings(
      req.body as StorefrontSettingsInput,
      req.user.userId,
    );

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user.userId,
      actorRole: 'admin',
      action: 'storefront_settings.update',
      targetType: 'StorefrontSettings',
      targetId: 'storefront',
      before: before as unknown as Record<string, unknown>,
      after: settings as unknown as Record<string, unknown>,
    });

    res.set('Cache-Control', 'no-store');
    return ok(res, settings, 'Đã cập nhật thông tin cửa hàng');
  } catch (caught) {
    return handleError(res, caught);
  }
};
