import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, type PlatformOSType } from 'react-native';

export type PushNotificationCategory =
  | 'order'
  | 'promotion'
  | 'support'
  | 'account'
  | 'virtual_try_on'
  | 'system';

export type PushNotificationPreferences = Record<PushNotificationCategory, boolean>;

export const defaultPushNotificationPreferences: PushNotificationPreferences = {
  order: true,
  promotion: true,
  support: true,
  account: true,
  virtual_try_on: true,
  system: true,
};

type NotificationResponse = {
  notification: {
    request: {
      identifier?: string;
      content: { data: Record<string, unknown> };
    };
  };
};

type NotificationModule = {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (input: { projectId: string }) => Promise<{ data: string }>;
  setNotificationHandler: (handler: object) => void;
  addNotificationResponseReceivedListener: (
    handler: (response: NotificationResponse) => void,
  ) => { remove: () => void };
  addPushTokenListener?: (
    handler: (token: { data: string }) => void,
  ) => { remove: () => void };
  setNotificationChannelAsync?: (
    channelId: string,
    channel: { name: string; importance: number; sound: string },
  ) => Promise<unknown>;
  getLastNotificationResponseAsync: () => Promise<NotificationResponse | null>;
  clearLastNotificationResponseAsync?: () => Promise<void>;
};

export type PushNotificationConfigInput = {
  mode?: string;
  projectId?: string;
  fallbackProjectId?: string;
  platform?: PlatformOSType;
  isExpoGo?: boolean;
};

export type PushNotificationCapability = {
  status: 'ready' | 'disabled' | 'unsupported' | 'expo_go' | 'missing_project_id';
  remoteEnabled: boolean;
  projectId: string;
  message: string;
};

export type PushNavigationTarget =
  | { screen: 'SupportTicketDetail'; params: { ticketId: string } }
  | { screen: 'OrderDetail'; params: { orderId: string } }
  | { screen: 'VirtualTryOnResult'; params: { jobId: string } }
  | { screen: 'VirtualTryOnProcessing'; params: { jobId: string } }
  | { screen: 'VirtualTryOnHome'; params?: undefined };

export type PushTokenResult =
  | { status: 'ready'; token: string; platform: 'ios' | 'android' }
  | { status: Exclude<PushNotificationCapability['status'], 'ready'> | 'permission_denied'; message: string };

const configuredEnvironment = {
  mode: process.env.EXPO_PUBLIC_PUSH_MODE,
  projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
};

const normalize = (value?: string) => value?.trim() ?? '';
const firstConfiguredValue = (...values: Array<string | null | undefined>) =>
  values.map((value) => normalize(value ?? undefined)).find(Boolean) ?? '';
const isExpoGoRuntime = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const resolvePushNotificationConfig = (
  input: PushNotificationConfigInput = {},
): PushNotificationCapability => {
  const mode = normalize(input.mode ?? configuredEnvironment.mode).toLowerCase();
  const platform = input.platform ?? Platform.OS;
  const isExpoGo = input.isExpoGo ?? isExpoGoRuntime;
  const runtimeFallbackProjectId = Object.prototype.hasOwnProperty.call(input, 'fallbackProjectId')
    ? input.fallbackProjectId
    : (Constants.expoConfig?.extra?.EAS_PROJECT_ID as string | undefined)
      || Constants.easConfig?.projectId;
  const projectId = firstConfiguredValue(
    input.projectId,
    configuredEnvironment.projectId,
    runtimeFallbackProjectId,
  );

  if (mode === 'disabled') {
    return {
      status: 'disabled',
      remoteEnabled: false,
      projectId,
      message: 'Thông báo đẩy đang được tắt cho môi trường này.',
    };
  }
  if (platform !== 'ios' && platform !== 'android') {
    return {
      status: 'unsupported',
      remoteEnabled: false,
      projectId,
      message: 'Thông báo đẩy chỉ hỗ trợ trên ứng dụng iOS và Android.',
    };
  }
  if (isExpoGo) {
    return {
      status: 'expo_go',
      remoteEnabled: false,
      projectId,
      message: 'Thông báo đẩy cần development build, không hỗ trợ trên Expo Go.',
    };
  }
  if (!projectId) {
    return {
      status: 'missing_project_id',
      remoteEnabled: false,
      projectId: '',
      message: 'Ứng dụng chưa được cấu hình EAS Project ID.',
    };
  }

  return {
    status: 'ready',
    remoteEnabled: true,
    projectId,
    message: 'Thiết bị có thể đăng ký nhận thông báo đẩy.',
  };
};

export const pushNotificationCapability = resolvePushNotificationConfig();

const loadNotifications = async (): Promise<NotificationModule> => {
  // Dynamic loading keeps web bundles from eagerly loading native notification code.
  return import('expo-notifications') as Promise<NotificationModule>;
};

export const requestPushToken = async (
  requestPermission: boolean,
  capability = pushNotificationCapability,
  moduleLoader: () => Promise<NotificationModule> = loadNotifications,
): Promise<PushTokenResult> => {
  if (!capability.remoteEnabled) {
    return {
      status: capability.status === 'ready' ? 'disabled' : capability.status,
      message: capability.message,
    };
  }

  const Notifications = await moduleLoader();
  if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Cập nhật từ Fashionista',
      importance: 4,
      sound: 'default',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : requestPermission
      ? await Notifications.requestPermissionsAsync()
      : current;
  if (permission.status !== 'granted') {
    return {
      status: 'permission_denied',
      message: requestPermission
        ? 'Bạn chưa cho phép ứng dụng gửi thông báo.'
        : 'Quyền thông báo chưa được bật trên thiết bị.',
    };
  }

  const result = await Notifications.getExpoPushTokenAsync({ projectId: capability.projectId });
  return {
    status: 'ready',
    token: result.data,
    platform: Platform.OS as 'ios' | 'android',
  };
};

export const resolvePushNavigationTarget = (
  data: Record<string, unknown> | null | undefined,
): PushNavigationTarget | null => {
  if (data?.type === 'support_reply' && typeof data.ticketId === 'string') {
    return { screen: 'SupportTicketDetail', params: { ticketId: data.ticketId } };
  }
  if (
    (data?.type === 'payment_deadline' || data?.type === 'shipping_update')
    && typeof data.orderId === 'string'
  ) {
    return { screen: 'OrderDetail', params: { orderId: data.orderId } };
  }
  if (data?.type === 'virtual_try_on' && typeof data.jobId === 'string') {
    return data.destination === 'result'
      ? { screen: 'VirtualTryOnResult', params: { jobId: data.jobId } }
      : { screen: 'VirtualTryOnProcessing', params: { jobId: data.jobId } };
  }
  if (data?.type === 'virtual_try_on_access') {
    return { screen: 'VirtualTryOnHome' };
  }
  return null;
};

export const subscribeToPushNotifications = async (
  onOpen: (target: PushNavigationTarget) => void,
  moduleLoader: () => Promise<NotificationModule> = loadNotifications,
) => {
  const Notifications = await moduleLoader();
  const handledIdentifiers = new Set<string>();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const open = (response: NotificationResponse | null) => {
    const request = response?.notification.request;
    if (!request) return;
    const identifier = request.identifier;
    if (identifier && handledIdentifiers.has(identifier)) return;
    const target = resolvePushNavigationTarget(request.content.data);
    if (!target) return;
    if (identifier) handledIdentifiers.add(identifier);
    onOpen(target);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  const initialResponse = await Notifications.getLastNotificationResponseAsync();
  open(initialResponse);
  if (initialResponse && Notifications.clearLastNotificationResponseAsync) {
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }
  return () => subscription.remove();
};

export const subscribeToPushTokenChanges = async (
  onToken: (token: string) => void,
  moduleLoader: () => Promise<NotificationModule> = loadNotifications,
) => {
  const Notifications = await moduleLoader();
  if (!Notifications.addPushTokenListener) return () => undefined;
  const subscription = Notifications.addPushTokenListener(({ data }) => {
    if (data) onToken(data);
  });
  return () => subscription.remove();
};
