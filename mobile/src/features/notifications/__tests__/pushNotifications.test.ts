import {
  requestPushToken,
  resolvePushNavigationTarget,
  resolvePushNotificationConfig,
  subscribeToPushNotifications,
  subscribeToPushTokenChanges,
} from '../pushNotifications';

const response = (
  identifier: string,
  data: Record<string, unknown>,
) => ({
  notification: {
    request: {
      identifier,
      content: { data },
    },
  },
});

describe('push notification capability', () => {
  it('keeps remote push disabled without EAS config while leaving a clear reason', () => {
    expect(resolvePushNotificationConfig({
      projectId: '',
      fallbackProjectId: '',
      platform: 'android',
      isExpoGo: false,
    })).toMatchObject({
      status: 'missing_project_id',
      remoteEnabled: false,
    });
  });

  it('uses auto mode only on a configured native development build', () => {
    expect(resolvePushNotificationConfig({
      projectId: 'project-id',
      platform: 'android',
      isExpoGo: false,
    })).toMatchObject({
      status: 'ready',
      remoteEnabled: true,
      projectId: 'project-id',
    });
    expect(resolvePushNotificationConfig({
      mode: 'disabled',
      projectId: 'project-id',
      platform: 'ios',
      isExpoGo: false,
    }).status).toBe('disabled');
    expect(resolvePushNotificationConfig({
      projectId: 'project-id',
      platform: 'android',
      isExpoGo: true,
    }).status).toBe('expo_go');
  });
});

describe('push navigation', () => {
  it('maps every supported payload to the intended screen', () => {
    expect(resolvePushNavigationTarget({
      type: 'support_reply',
      ticketId: 'ticket-1',
    })).toEqual({
      screen: 'SupportTicketDetail',
      params: { ticketId: 'ticket-1' },
    });
    expect(resolvePushNavigationTarget({
      type: 'shipping_update',
      orderId: 'order-1',
    })).toEqual({
      screen: 'OrderDetail',
      params: { orderId: 'order-1' },
    });
    expect(resolvePushNavigationTarget({
      type: 'order_update',
      orderId: 'order-2',
    })).toEqual({
      screen: 'OrderDetail',
      params: { orderId: 'order-2' },
    });
    expect(resolvePushNavigationTarget({
      type: 'virtual_try_on',
      jobId: 'job-1',
      destination: 'result',
    })).toEqual({
      screen: 'VirtualTryOnResult',
      params: { jobId: 'job-1' },
    });
    expect(resolvePushNavigationTarget({ type: 'unknown' })).toBeNull();
  });

  it('handles killed-state and live notification responses once', async () => {
    let liveHandler: ((value: ReturnType<typeof response>) => void) | undefined;
    const remove = jest.fn();
    const clearLastNotificationResponseAsync = jest.fn().mockResolvedValue(undefined);
    const notificationModule = {
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
      getExpoPushTokenAsync: jest.fn(),
      setNotificationHandler: jest.fn(),
      addNotificationResponseReceivedListener: jest.fn((handler) => {
        liveHandler = handler;
        return { remove };
      }),
      getLastNotificationResponseAsync: jest.fn().mockResolvedValue(response('cold-1', {
        type: 'payment_deadline',
        orderId: 'order-cold',
        notificationId: 'notification-cold',
      })),
      clearLastNotificationResponseAsync,
    };
    const onOpen = jest.fn();

    const unsubscribe = await subscribeToPushNotifications(
      onOpen,
      async () => notificationModule,
    );
    expect(onOpen).toHaveBeenCalledWith({
      screen: 'OrderDetail',
      params: { orderId: 'order-cold' },
    }, 'notification-cold');
    expect(clearLastNotificationResponseAsync).toHaveBeenCalled();

    const liveResponse = response('live-1', {
      type: 'support_reply',
      ticketId: 'ticket-live',
    });
    liveHandler?.(liveResponse);
    liveHandler?.(liveResponse);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenLastCalledWith({
      screen: 'SupportTicketDetail',
      params: { ticketId: 'ticket-live' },
    });

    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });

  it('does not request OS permission during a silent refresh', async () => {
    const notificationModule = {
      getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
      requestPermissionsAsync: jest.fn(),
      getExpoPushTokenAsync: jest.fn(),
      setNotificationHandler: jest.fn(),
      addNotificationResponseReceivedListener: jest.fn(),
      getLastNotificationResponseAsync: jest.fn(),
    };
    const capability = resolvePushNotificationConfig({
      projectId: 'project-id',
      platform: 'android',
      isExpoGo: false,
    });

    await expect(requestPushToken(
      false,
      capability,
      async () => notificationModule,
    )).resolves.toMatchObject({ status: 'permission_denied' });
    expect(notificationModule.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('treats native token changes as a refresh signal instead of an Expo token', async () => {
    let nativeTokenHandler: ((token: { data: string }) => void) | undefined;
    const remove = jest.fn();
    const notificationModule = {
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
      getExpoPushTokenAsync: jest.fn(),
      setNotificationHandler: jest.fn(),
      addNotificationResponseReceivedListener: jest.fn(),
      addPushTokenListener: jest.fn((handler) => {
        nativeTokenHandler = handler;
        return { remove };
      }),
      getLastNotificationResponseAsync: jest.fn(),
    };
    const onChange = jest.fn();

    const unsubscribe = await subscribeToPushTokenChanges(
      onChange,
      async () => notificationModule,
    );
    nativeTokenHandler?.({ data: 'native-fcm-token-that-backend-must-not-receive' });

    expect(onChange).toHaveBeenCalledWith();
    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });
});
