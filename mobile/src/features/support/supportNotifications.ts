import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NotificationResponse = {
  notification: { request: { content: { data: Record<string, unknown> } } };
};
type NotificationModule = {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (input: { projectId: string }) => Promise<{ data: string }>;
  setNotificationHandler: (handler: object) => void;
  addNotificationResponseReceivedListener: (handler: (response: NotificationResponse) => void) => { remove: () => void };
  getLastNotificationResponseAsync: () => Promise<NotificationResponse | null>;
};

const loadNotifications = async (): Promise<NotificationModule> => {
  // The dependency is installed by npm ci; dynamic loading keeps web bundles from eagerly loading native code.
  return import('expo-notifications') as Promise<NotificationModule>;
};

export const requestSupportPushToken = async () => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Thông báo đẩy chỉ hỗ trợ trên ứng dụng iOS và Android.');
  }

  const Notifications = await loadNotifications();
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Bạn chưa cho phép ứng dụng gửi thông báo.');
  }

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || (Constants.expoConfig?.extra?.EAS_PROJECT_ID as string | undefined)
    || Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Ứng dụng chưa được cấu hình EAS Project ID.');

  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: result.data, platform: Platform.OS as 'ios' | 'android' };
};

export const subscribeToSupportNotifications = async (
  onTicket: (ticketId: string) => void,
) => {
  const Notifications = await loadNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const open = (response: NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (data?.type === 'support_reply' && typeof data.ticketId === 'string') onTicket(data.ticketId);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  open(await Notifications.getLastNotificationResponseAsync());
  return () => subscription.remove();
};
