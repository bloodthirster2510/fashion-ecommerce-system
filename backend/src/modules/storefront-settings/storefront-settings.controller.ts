import type { Request, Response } from 'express';
import { auditLogService } from '../audit-logs/audit-log.service';
import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadToCloudinary,
} from '../../utils/cloudinary.util';
import { error, ok } from '../../utils/response';
import {
  StorefrontSettingsServiceError,
  storefrontSettingsService,
  type StorefrontSettingsInput,
} from './storefront-settings.service';

const CLOUDINARY_HOST = 'res.cloudinary.com';

const parseSettingsInput = (req: Request): StorefrontSettingsInput => {
  if (!req.file) return req.body as StorefrontSettingsInput;

  if (typeof req.body?.settings !== 'string') {
    throw new StorefrontSettingsServiceError('Dữ liệu cấu hình không hợp lệ');
  }

  try {
    return JSON.parse(req.body.settings) as StorefrontSettingsInput;
  } catch {
    throw new StorefrontSettingsServiceError('Dữ liệu cấu hình không hợp lệ');
  }
};

const deleteStorefrontAvatar = async (avatarUrl?: string | null) => {
  if (!avatarUrl) return;

  try {
    const url = new URL(avatarUrl);
    if (url.hostname !== CLOUDINARY_HOST) return;
    await deleteFromCloudinary(extractPublicIdFromUrl(avatarUrl));
  } catch (caught) {
    console.warn('Failed to delete storefront avatar:', caught);
  }
};

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
  let uploadedAvatarUrl: string | null = null;

  try {
    if (!req.user?.userId || req.user.role !== 'admin') {
      return error(res, 'Authentication required', 401);
    }

    const before = await storefrontSettingsService.getAdminSettings();
    const input = parseSettingsInput(req);

    if (req.file) {
      const uploaded = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        'fashion-ecommerce/storefront',
      );
      uploadedAvatarUrl = uploaded.secure_url;
      input.identity = { ...input.identity, avatarUrl: uploadedAvatarUrl };
    }

    const settings = await storefrontSettingsService.updateSettings(
      input,
      req.user.userId,
    );

    if (before.identity.avatarUrl && before.identity.avatarUrl !== settings.identity.avatarUrl) {
      await deleteStorefrontAvatar(before.identity.avatarUrl);
    }

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
    await deleteStorefrontAvatar(uploadedAvatarUrl);
    return handleError(res, caught);
  }
};
