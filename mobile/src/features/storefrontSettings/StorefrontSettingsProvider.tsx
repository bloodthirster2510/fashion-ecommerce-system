import React from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState } from 'react-native';
import { apiFetch } from '../../config/api';
import {
  storefrontSocialPlatforms,
  type StorefrontSettings,
  type StorefrontSocialPlatform,
} from './storefrontSettings.types';

type ApiResponse<T> = { message?: string; data?: T };
type StorefrontSettingsContextValue = {
  settings: StorefrontSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const MAX_SOCIAL_LINKS = 12;
const CACHE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}storefront-settings-v1.json`
  : null;

const env = (value: string | undefined) => value?.trim() || '';
const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const safeHttpsEnv = (value: string | undefined) => {
  const normalized = env(value);
  return normalized && isHttpsUrl(normalized) ? new URL(normalized).toString() : '';
};

const fallbackSocialCandidates: Array<[StorefrontSocialPlatform, string, string]> = [
  ['facebook', 'Facebook', safeHttpsEnv(process.env.EXPO_PUBLIC_FACEBOOK_URL)],
  ['instagram', 'Instagram', safeHttpsEnv(process.env.EXPO_PUBLIC_INSTAGRAM_URL)],
  ['tiktok', 'TikTok', safeHttpsEnv(process.env.EXPO_PUBLIC_TIKTOK_URL)],
  ['youtube', 'YouTube', safeHttpsEnv(process.env.EXPO_PUBLIC_YOUTUBE_URL)],
  ['zalo', 'Zalo', safeHttpsEnv(process.env.EXPO_PUBLIC_ZALO_URL)],
];

const fallbackSettings: StorefrontSettings = {
  configured: false,
  identity: {
    name: env(process.env.EXPO_PUBLIC_SHOP_NAME) || 'FASHIONISTA',
    avatarUrl: safeHttpsEnv(process.env.EXPO_PUBLIC_SHOP_AVATAR_URL),
    legalName: '',
    taxCode: '',
    tagline: env(process.env.EXPO_PUBLIC_SHOP_TAGLINE) || 'Mặc đúng gu. Tự tin theo cách của bạn.',
    description: env(process.env.EXPO_PUBLIC_SHOP_DESCRIPTION),
  },
  contact: {
    phone: env(process.env.EXPO_PUBLIC_SHOP_PHONE) || '0123 456 789',
    email: env(process.env.EXPO_PUBLIC_SHOP_EMAIL) || 'cuahang@gmail.com',
    hours: env(process.env.EXPO_PUBLIC_SHOP_HOURS) || '08:30 – 21:45 mỗi ngày',
    address: env(process.env.EXPO_PUBLIC_SHOP_ADDRESS),
    mapUrl: safeHttpsEnv(process.env.EXPO_PUBLIC_SHOP_MAP_URL),
  },
  socials: fallbackSocialCandidates
    .filter(([, , url]) => Boolean(url))
    .map(([platform, label, url], sortOrder) => ({ platform, label, url, enabled: true, sortOrder })),
  version: 0,
  updatedAt: null,
};

const hasStringFields = (value: unknown, fields: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return fields.every((field) => typeof record[field] === 'string');
};

export const isStorefrontSettings = (value: unknown): value is StorefrontSettings => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StorefrontSettings>;
  if (
    typeof candidate.configured !== 'boolean'
    || !hasStringFields(candidate.identity, ['name', 'avatarUrl', 'legalName', 'taxCode', 'tagline', 'description'])
    || !hasStringFields(candidate.contact, ['phone', 'email', 'hours', 'address', 'mapUrl'])
    || !Array.isArray(candidate.socials)
    || candidate.socials.length > MAX_SOCIAL_LINKS
    || !Number.isInteger(candidate.version)
    || (candidate.version ?? -1) < 0
    || (candidate.configured ? candidate.version === 0 : candidate.version !== 0)
    || (candidate.updatedAt !== null && typeof candidate.updatedAt !== 'string')
    || (typeof candidate.updatedAt === 'string' && Number.isNaN(Date.parse(candidate.updatedAt)))
    || (candidate.configured ? candidate.updatedAt === null : candidate.updatedAt !== null)
    || (Boolean(candidate.identity?.avatarUrl) && !isHttpsUrl(candidate.identity?.avatarUrl ?? ''))
    || (Boolean(candidate.contact?.mapUrl) && !isHttpsUrl(candidate.contact?.mapUrl ?? ''))
  ) return false;

  const seenPlatforms = new Set<string>();
  return candidate.socials.every((social) => {
    if (
      !social
      || typeof social !== 'object'
      || !storefrontSocialPlatforms.includes(social.platform)
      || typeof social.label !== 'string'
      || typeof social.url !== 'string'
      || !isHttpsUrl(social.url)
      || typeof social.enabled !== 'boolean'
      || !Number.isInteger(social.sortOrder)
      || social.sortOrder < 0
      || (social.platform !== 'other' && seenPlatforms.has(social.platform))
    ) return false;

    if (social.platform !== 'other') seenPlatforms.add(social.platform);
    return true;
  });
};

const preferValue = (serverValue: string, fallbackValue: string) => serverValue.trim() || fallbackValue;

export const resolveStorefrontSettings = (settings: StorefrontSettings): StorefrontSettings => {
  const visibleSocials = settings.socials
    .filter((social) => social.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (settings.configured) {
    return {
      ...settings,
      socials: visibleSocials,
    };
  }

  return {
    ...settings,
    identity: {
      name: preferValue(settings.identity.name, fallbackSettings.identity.name),
      avatarUrl: preferValue(settings.identity.avatarUrl, fallbackSettings.identity.avatarUrl),
      legalName: preferValue(settings.identity.legalName, fallbackSettings.identity.legalName),
      taxCode: preferValue(settings.identity.taxCode, fallbackSettings.identity.taxCode),
      tagline: preferValue(settings.identity.tagline, fallbackSettings.identity.tagline),
      description: preferValue(settings.identity.description, fallbackSettings.identity.description),
    },
    contact: {
      phone: preferValue(settings.contact.phone, fallbackSettings.contact.phone),
      email: preferValue(settings.contact.email, fallbackSettings.contact.email),
      hours: preferValue(settings.contact.hours, fallbackSettings.contact.hours),
      address: preferValue(settings.contact.address, fallbackSettings.contact.address),
      mapUrl: preferValue(settings.contact.mapUrl, fallbackSettings.contact.mapUrl),
    },
    socials: settings.socials.length ? visibleSocials : fallbackSettings.socials,
  };
};

export const preferFreshStorefrontSettings = (
  current: StorefrontSettings,
  incoming: StorefrontSettings,
) => incoming.version >= current.version ? incoming : current;

const readCache = async () => {
  if (!CACHE_FILE_URI) return null;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE_URI);
    if (!info.exists) return null;
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(CACHE_FILE_URI)) as unknown;
    return isStorefrontSettings(parsed) ? resolveStorefrontSettings(parsed) : null;
  } catch {
    return null;
  }
};

const writeCache = async (settings: StorefrontSettings) => {
  if (!CACHE_FILE_URI) return;
  try {
    await FileSystem.writeAsStringAsync(CACHE_FILE_URI, JSON.stringify(settings));
  } catch {
    // The current session can still use the live value when persistent storage fails.
  }
};

const fetchSettings = async () => {
  const response = await apiFetch('/storefront/settings', { timeoutMs: 10000 });
  const payload = JSON.parse((await response.text()) || '{}') as ApiResponse<StorefrontSettings>;
  if (!response.ok || !isStorefrontSettings(payload.data)) {
    throw new Error(payload.message || 'Không thể tải thông tin cửa hàng.');
  }
  return resolveStorefrontSettings(payload.data);
};

const StorefrontSettingsContext = React.createContext<StorefrontSettingsContextValue | null>(null);

export function StorefrontSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState(fallbackSettings);
  const [isLoading, setIsLoading] = React.useState(true);
  const settingsRef = React.useRef(fallbackSettings);
  const mountedRef = React.useRef(true);
  const cacheWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const applySettings = React.useCallback((incoming: StorefrontSettings, persist: boolean) => {
    if (!mountedRef.current) return Promise.resolve();

    const next = preferFreshStorefrontSettings(settingsRef.current, incoming);
    if (next === settingsRef.current) return Promise.resolve();

    settingsRef.current = next;
    setSettings(next);
    if (!persist) return Promise.resolve();

    cacheWriteQueueRef.current = cacheWriteQueueRef.current.then(() => writeCache(next));
    return cacheWriteQueueRef.current;
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      await applySettings(await fetchSettings(), true);
    } catch {
      // Keep the cached or bundled fallback value.
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [applySettings]);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await readCache();
      if (active && cached) await applySettings(cached, false);
      if (active) await refresh();
    })();
    return () => { active = false; };
  }, [applySettings, refresh]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = React.useMemo(() => ({ settings, isLoading, refresh }), [isLoading, refresh, settings]);
  return <StorefrontSettingsContext.Provider value={value}>{children}</StorefrontSettingsContext.Provider>;
}

export const useStorefrontSettings = () => {
  const context = React.useContext(StorefrontSettingsContext);
  if (!context) throw new Error('useStorefrontSettings must be used inside StorefrontSettingsProvider');
  return context;
};
