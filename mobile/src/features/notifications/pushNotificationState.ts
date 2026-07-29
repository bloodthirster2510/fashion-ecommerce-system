import {
  defaultPushNotificationPreferences,
  type PushNotificationCategory,
  type PushNotificationPreferences,
} from './pushNotifications';

export type StoredPushState = {
  enabled: boolean;
  token?: string;
  platform?: 'ios' | 'android';
  preferences: PushNotificationPreferences;
};

export const initialPushNotificationState: StoredPushState = {
  enabled: false,
  preferences: defaultPushNotificationPreferences,
};

export const normalizeStoredPushState = (value: unknown): StoredPushState => {
  if (!value || typeof value !== 'object') return initialPushNotificationState;
  const input = value as Partial<StoredPushState>;
  const rawPreferences: Partial<PushNotificationPreferences> =
    input.preferences && typeof input.preferences === 'object'
      ? input.preferences
      : {};

  return {
    enabled: input.enabled === true,
    ...(typeof input.token === 'string' && input.token ? { token: input.token } : {}),
    ...(input.platform === 'ios' || input.platform === 'android'
      ? { platform: input.platform }
      : {}),
    preferences: Object.fromEntries(
      Object.keys(defaultPushNotificationPreferences).map((category) => [
        category,
        typeof rawPreferences[category as PushNotificationCategory] === 'boolean'
          ? rawPreferences[category as PushNotificationCategory]
          : true,
      ]),
    ) as PushNotificationPreferences,
  };
};

export const shouldOpenDeviceNotificationSettings = (error: string) =>
  error.toLocaleLowerCase('vi-VN').includes('quyền');
