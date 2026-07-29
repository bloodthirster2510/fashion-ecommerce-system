import React from 'react';
import { AppState } from 'react-native';
import { sessionStorage } from '../auth/sessionStorage';
import { useAuth } from '../auth/AuthContext';
import { notificationApi } from './notificationApi';
import {
  defaultPushNotificationPreferences,
  pushNotificationCapability,
  requestPushToken,
  subscribeToPushTokenChanges,
  type PushNotificationCategory,
  type PushNotificationPreferences,
} from './pushNotifications';

type StoredPushState = {
  enabled: boolean;
  token?: string;
  platform?: 'ios' | 'android';
  preferences: PushNotificationPreferences;
};

type PushNotificationContextValue = {
  capability: typeof pushNotificationCapability;
  enabled: boolean;
  loading: boolean;
  error: string;
  preferences: PushNotificationPreferences;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  setCategoryEnabled: (category: PushNotificationCategory, enabled: boolean) => Promise<void>;
  refreshRegistration: () => Promise<void>;
};

const STORAGE_KEY = 'fashionista.pushNotifications.v1';
const PushNotificationContext = React.createContext<PushNotificationContextValue | null>(null);

const initialState: StoredPushState = {
  enabled: false,
  preferences: defaultPushNotificationPreferences,
};

const normalizeStoredState = (value: unknown): StoredPushState => {
  if (!value || typeof value !== 'object') return initialState;
  const input = value as Partial<StoredPushState>;
  const rawPreferences: Partial<PushNotificationPreferences> =
    input.preferences && typeof input.preferences === 'object'
      ? input.preferences
      : {};

  return {
    enabled: input.enabled === true,
    ...(typeof input.token === 'string' && input.token ? { token: input.token } : {}),
    ...(input.platform === 'ios' || input.platform === 'android' ? { platform: input.platform } : {}),
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

export const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { runWithAuth, session } = useAuth();
  const [state, setState] = React.useState<StoredPushState>(initialState);
  const [restoring, setRestoring] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState('');
  const stateRef = React.useRef(state);
  const syncPromiseRef = React.useRef<Promise<void> | null>(null);
  stateRef.current = state;

  const persist = React.useCallback(async (nextState: StoredPushState) => {
    stateRef.current = nextState;
    setState(nextState);
    await sessionStorage.setItemAsync(STORAGE_KEY, JSON.stringify(nextState));
  }, []);

  React.useEffect(() => {
    let mounted = true;
    sessionStorage.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const restored = normalizeStoredState(JSON.parse(raw));
        stateRef.current = restored;
        setState(restored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setRestoring(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const replaceToken = React.useCallback(async (
    pushToken: string,
    platform: 'ios' | 'android',
    nextPreferences = stateRef.current.preferences,
  ) => {
    const previousToken = stateRef.current.token;
    await runWithAuth((accessToken) => notificationApi.registerPushToken(
      accessToken,
      pushToken,
      platform,
      nextPreferences,
    ));
    await persist({
      enabled: true,
      token: pushToken,
      platform,
      preferences: nextPreferences,
    });
    if (previousToken && previousToken !== pushToken) {
      await runWithAuth((accessToken) => (
        notificationApi.unregisterPushToken(accessToken, previousToken)
      )).catch(() => undefined);
    }
  }, [persist, runWithAuth]);

  const syncRegistration = React.useCallback(async (requestPermission: boolean, force = false) => {
    if (syncPromiseRef.current) return syncPromiseRef.current;
    if (!session?.accessToken || restoring || (!force && !stateRef.current.enabled)) return;

    const work = (async () => {
      setSyncing(true);
      setError('');
      try {
        const result = await requestPushToken(requestPermission);
        if (result.status !== 'ready') {
          setError(result.message);
          if (force) throw new Error(result.message);
          return;
        }
        await replaceToken(result.token, result.platform);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Không thể đăng ký thông báo đẩy.';
        setError(message);
        throw caught;
      } finally {
        setSyncing(false);
      }
    })();

    syncPromiseRef.current = work.finally(() => {
      syncPromiseRef.current = null;
    });
    return syncPromiseRef.current;
  }, [replaceToken, restoring, session?.accessToken]);

  React.useEffect(() => {
    if (restoring || !session?.accessToken || !state.enabled) return;
    void syncRegistration(false).catch(() => undefined);
  }, [restoring, session?.accessToken, state.enabled, syncRegistration]);

  React.useEffect(() => {
    if (!pushNotificationCapability.remoteEnabled) return;
    let unsubscribe: (() => void) | undefined;
    subscribeToPushTokenChanges((token) => {
      const current = stateRef.current;
      if (!current.enabled || !current.platform || !session?.accessToken || token === current.token) return;
      void replaceToken(token, current.platform).catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Không thể cập nhật push token.');
      });
    }).then((cleanup) => {
      unsubscribe = cleanup;
    }).catch(() => undefined);
    return () => unsubscribe?.();
  }, [replaceToken, session?.accessToken]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && stateRef.current.enabled) {
        void syncRegistration(false).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [syncRegistration]);

  const enable = React.useCallback(
    () => syncRegistration(true, true),
    [syncRegistration],
  );

  const disable = React.useCallback(async () => {
    const current = stateRef.current;
    setSyncing(true);
    setError('');
    try {
      if (current.token && session?.accessToken) {
        await runWithAuth((accessToken) => (
          notificationApi.unregisterPushToken(accessToken, current.token!)
        ));
      }
      await persist({
        enabled: false,
        preferences: current.preferences,
      });
    } finally {
      setSyncing(false);
    }
  }, [persist, runWithAuth, session?.accessToken]);

  const setCategoryEnabled = React.useCallback(async (
    category: PushNotificationCategory,
    enabled: boolean,
  ) => {
    const current = stateRef.current;
    const nextPreferences = { ...current.preferences, [category]: enabled };
    setSyncing(true);
    setError('');
    try {
      if (current.enabled && current.token && current.platform && session?.accessToken) {
        await runWithAuth((accessToken) => notificationApi.registerPushToken(
          accessToken,
          current.token!,
          current.platform!,
          nextPreferences,
        ));
      }
      await persist({ ...current, preferences: nextPreferences });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể lưu cài đặt thông báo.';
      setError(message);
      throw caught;
    } finally {
      setSyncing(false);
    }
  }, [persist, runWithAuth, session?.accessToken]);

  const value = React.useMemo<PushNotificationContextValue>(() => ({
    capability: pushNotificationCapability,
    enabled: state.enabled,
    loading: restoring || syncing,
    error,
    preferences: state.preferences,
    enable,
    disable,
    setCategoryEnabled,
    refreshRegistration: () => syncRegistration(false, true),
  }), [
    disable,
    enable,
    error,
    restoring,
    setCategoryEnabled,
    state.enabled,
    state.preferences,
    syncing,
    syncRegistration,
  ]);

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};

export const usePushNotifications = () => {
  const context = React.useContext(PushNotificationContext);
  if (!context) throw new Error('usePushNotifications must be used inside PushNotificationProvider');
  return context;
};
