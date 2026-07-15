import { Types } from 'mongoose';
import {
  StorefrontSettings,
  storefrontSocialPlatforms,
  type IStorefrontContact,
  type IStorefrontIdentity,
  type IStorefrontSocialLink,
  type StorefrontSocialPlatform,
} from '../../database/models/storefront-settings.model';

const STOREFRONT_KEY = 'storefront';
const MAX_SOCIAL_LINKS = 12;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\-.\s]{7,30}$/;
const taxCodePattern = /^[0-9A-Za-z-]{3,30}$/;
const knownSocialPlatformSet = new Set<string>(storefrontSocialPlatforms);

export type StorefrontSettingsView = {
  configured: boolean;
  identity: IStorefrontIdentity;
  contact: IStorefrontContact;
  socials: IStorefrontSocialLink[];
  version: number;
  updatedAt: string | null;
};

export type StorefrontSettingsInput = {
  identity?: Partial<Record<keyof IStorefrontIdentity, unknown>>;
  contact?: Partial<Record<keyof IStorefrontContact, unknown>>;
  socials?: Array<Partial<Record<keyof IStorefrontSocialLink, unknown>>>;
  version?: unknown;
};

export class StorefrontSettingsServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'StorefrontSettingsServiceError';
    this.statusCode = statusCode;
  }
}

const requiredString = (value: unknown, label: string, min: number, max: number) => {
  if (typeof value !== 'string') {
    throw new StorefrontSettingsServiceError(`${label} không hợp lệ`);
  }

  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new StorefrontSettingsServiceError(`${label} phải có từ ${min} đến ${max} ký tự`);
  }
  return normalized;
};

const optionalString = (value: unknown, label: string, max: number) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new StorefrontSettingsServiceError(`${label} không hợp lệ`);
  }

  const normalized = value.trim();
  if (normalized.length > max) {
    throw new StorefrontSettingsServiceError(`${label} không được vượt quá ${max} ký tự`);
  }
  return normalized;
};

const httpsUrl = (value: unknown, label: string, required = false) => {
  const normalized = optionalString(value, label, 1000);
  if (!normalized && !required) return '';
  if (!normalized) throw new StorefrontSettingsServiceError(`${label} là bắt buộc`);

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:') throw new Error('invalid protocol');
    return url.toString();
  } catch {
    throw new StorefrontSettingsServiceError(`${label} phải là liên kết HTTPS hợp lệ`);
  }
};

const envValue = (key: string) => process.env[key]?.trim() || '';

const safeEnvUrl = (key: string) => {
  const value = envValue(key);
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const defaultSocials = () => {
  const candidates: Array<[StorefrontSocialPlatform, string, string]> = [
    ['facebook', 'Facebook', safeEnvUrl('SHOP_FACEBOOK_URL')],
    ['instagram', 'Instagram', safeEnvUrl('SHOP_INSTAGRAM_URL')],
    ['tiktok', 'TikTok', safeEnvUrl('SHOP_TIKTOK_URL')],
    ['youtube', 'YouTube', safeEnvUrl('SHOP_YOUTUBE_URL')],
    ['zalo', 'Zalo', safeEnvUrl('SHOP_ZALO_URL')],
  ];

  return candidates
    .filter(([, , url]) => Boolean(url))
    .map(([platform, label, url], sortOrder) => ({ platform, label, url, enabled: true, sortOrder }));
};

const getDefaultSettings = (): StorefrontSettingsView => ({
  configured: false,
  identity: {
    name: envValue('SHOP_NAME') || 'FASHIONISTA',
    avatarUrl: safeEnvUrl('SHOP_AVATAR_URL'),
    legalName: envValue('SHOP_LEGAL_NAME'),
    taxCode: envValue('SHOP_TAX_CODE'),
    tagline: envValue('SHOP_TAGLINE'),
    description: envValue('SHOP_DESCRIPTION'),
  },
  contact: {
    phone: envValue('SHOP_PHONE'),
    email: envValue('SHOP_EMAIL').toLowerCase(),
    hours: envValue('SHOP_HOURS'),
    address: envValue('SHOP_ADDRESS'),
    mapUrl: safeEnvUrl('SHOP_MAP_URL'),
  },
  socials: defaultSocials(),
  version: 0,
  updatedAt: null,
});

const serialize = (value: Record<string, unknown>, configured = true): StorefrontSettingsView => {
  const identity = value.identity as IStorefrontIdentity;
  const contact = value.contact as IStorefrontContact;
  const socials = Array.isArray(value.socials) ? value.socials as IStorefrontSocialLink[] : [];
  const updatedAt = value.updatedAt instanceof Date
    ? value.updatedAt.toISOString()
    : typeof value.updatedAt === 'string' ? value.updatedAt : null;

  return {
    configured,
    identity: {
      name: identity.name,
      avatarUrl: identity.avatarUrl || '',
      legalName: identity.legalName || '',
      taxCode: identity.taxCode || '',
      tagline: identity.tagline || '',
      description: identity.description || '',
    },
    contact: {
      phone: contact.phone || '',
      email: contact.email || '',
      hours: contact.hours || '',
      address: contact.address || '',
      mapUrl: contact.mapUrl || '',
    },
    socials: socials
      .map((item) => ({
        platform: item.platform,
        label: item.label,
        url: item.url,
        enabled: item.enabled !== false,
        sortOrder: item.sortOrder,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    version: Number(value.version) || 1,
    updatedAt,
  };
};

const toPlainObject = (value: unknown) => {
  if (value && typeof value === 'object' && 'toObject' in value && typeof value.toObject === 'function') {
    return value.toObject() as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
};

export const normalizeStorefrontSettingsInput = (input: StorefrontSettingsInput) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new StorefrontSettingsServiceError('Dữ liệu cấu hình không hợp lệ');
  }

  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 0) {
    throw new StorefrontSettingsServiceError('Phiên bản cấu hình không hợp lệ');
  }

  if (!input.identity || typeof input.identity !== 'object' || Array.isArray(input.identity)) {
    throw new StorefrontSettingsServiceError('Thông tin nhận diện cửa hàng không hợp lệ');
  }
  if (!input.contact || typeof input.contact !== 'object' || Array.isArray(input.contact)) {
    throw new StorefrontSettingsServiceError('Thông tin liên hệ cửa hàng không hợp lệ');
  }
  if (!Array.isArray(input.socials) || input.socials.length > MAX_SOCIAL_LINKS) {
    throw new StorefrontSettingsServiceError(`Chỉ được cấu hình tối đa ${MAX_SOCIAL_LINKS} liên kết mạng xã hội`);
  }

  const identity: IStorefrontIdentity = {
    name: requiredString(input.identity.name, 'Tên cửa hàng', 2, 80),
    avatarUrl: httpsUrl(input.identity.avatarUrl, 'Ảnh đại diện cửa hàng'),
    legalName: optionalString(input.identity.legalName, 'Tên pháp lý', 160),
    taxCode: optionalString(input.identity.taxCode, 'Mã số thuế', 30),
    tagline: optionalString(input.identity.tagline, 'Slogan', 160),
    description: optionalString(input.identity.description, 'Giới thiệu cửa hàng', 500),
  };

  if (identity.taxCode && !taxCodePattern.test(identity.taxCode)) {
    throw new StorefrontSettingsServiceError('Mã số thuế chỉ được chứa chữ, số và dấu gạch ngang');
  }

  const contact: IStorefrontContact = {
    phone: optionalString(input.contact.phone, 'Số điện thoại', 30),
    email: optionalString(input.contact.email, 'Email', 254).toLowerCase(),
    hours: optionalString(input.contact.hours, 'Giờ hỗ trợ', 120),
    address: optionalString(input.contact.address, 'Địa chỉ', 300),
    mapUrl: httpsUrl(input.contact.mapUrl, 'Liên kết bản đồ'),
  };

  if (contact.phone && !phonePattern.test(contact.phone)) {
    throw new StorefrontSettingsServiceError('Số điện thoại không đúng định dạng');
  }
  if (contact.email && !emailPattern.test(contact.email)) {
    throw new StorefrontSettingsServiceError('Email không đúng định dạng');
  }

  const seenPlatforms = new Set<string>();
  const socials = input.socials.map((item, index): IStorefrontSocialLink => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new StorefrontSettingsServiceError(`Liên kết mạng xã hội thứ ${index + 1} không hợp lệ`);
    }

    const platform = typeof item.platform === 'string' ? item.platform.trim().toLowerCase() : '';
    if (!knownSocialPlatformSet.has(platform)) {
      throw new StorefrontSettingsServiceError(`Nền tảng mạng xã hội thứ ${index + 1} không hợp lệ`);
    }
    if (platform !== 'other' && seenPlatforms.has(platform)) {
      throw new StorefrontSettingsServiceError(`Nền tảng ${platform} đang bị trùng`);
    }
    if (platform !== 'other') seenPlatforms.add(platform);

    return {
      platform: platform as StorefrontSocialPlatform,
      label: requiredString(item.label, `Tên liên kết thứ ${index + 1}`, 2, 40),
      url: httpsUrl(item.url, `URL liên kết thứ ${index + 1}`, true),
      enabled: item.enabled !== false,
      sortOrder: index,
    };
  });

  return { version, identity, contact, socials };
};

const getAdminSettings = async () => {
  const settings = await StorefrontSettings.findOne({ key: STOREFRONT_KEY }).lean();
  return settings ? serialize(settings as unknown as Record<string, unknown>) : getDefaultSettings();
};

const getPublicSettings = async () => {
  const settings = await getAdminSettings();
  return {
    ...settings,
    socials: settings.socials.filter((item) => item.enabled),
  };
};

const updateSettings = async (input: StorefrontSettingsInput, actorId: string) => {
  if (!Types.ObjectId.isValid(actorId)) {
    throw new StorefrontSettingsServiceError('Tài khoản quản trị không hợp lệ', 401);
  }

  const normalized = normalizeStorefrontSettingsInput(input);
  const updatedBy = new Types.ObjectId(actorId);

  if (normalized.version === 0) {
    try {
      const created = await StorefrontSettings.create({
        key: STOREFRONT_KEY,
        identity: normalized.identity,
        contact: normalized.contact,
        socials: normalized.socials,
        version: 1,
        updatedBy,
      });
      return serialize(toPlainObject(created));
    } catch (caught) {
      if ((caught as { code?: number })?.code === 11000) {
        throw new StorefrontSettingsServiceError(
          'Cấu hình đã được thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.',
          409,
        );
      }
      throw caught;
    }
  }

  const updated = await StorefrontSettings.findOneAndUpdate(
    { key: STOREFRONT_KEY, version: normalized.version },
    {
      $set: {
        identity: normalized.identity,
        contact: normalized.contact,
        socials: normalized.socials,
        updatedBy,
      },
      $inc: { version: 1 },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!updated) {
    throw new StorefrontSettingsServiceError(
      'Cấu hình đã được thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.',
      409,
    );
  }

  return serialize(updated as unknown as Record<string, unknown>);
};

export const storefrontSettingsService = {
  getAdminSettings,
  getPublicSettings,
  updateSettings,
};
