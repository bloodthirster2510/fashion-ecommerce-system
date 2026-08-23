import { PushToken } from '../../../database/models';
import {
  normalizePushPreferences,
  registerPushToken,
  sendCustomerPush,
  unregisterPushToken,
} from '../push-notification.service';

jest.mock('../../../database/models', () => ({
  CUSTOMER_NOTIFICATION_CATEGORIES: [
    'order',
    'promotion',
    'support',
    'account',
    'virtual_try_on',
    'system',
  ],
  PushToken: {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock('../customer-notification.service', () => ({
  createCustomerNotificationBestEffort: jest.fn(),
}));

const mockedPushToken = PushToken as jest.Mocked<typeof PushToken>;
const userId = '665000000000000000000001';

const mockTokenQuery = (tokens: Array<Record<string, unknown>>) => {
  const lean = jest.fn().mockResolvedValue(tokens);
  const select = jest.fn().mockReturnValue({ lean });
  mockedPushToken.find.mockReturnValue({ select } as never);
  return { lean, select };
};

describe('push notification service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.EXPO_ACCESS_TOKEN;
  });

  it('normalizes missing category preferences to enabled', () => {
    expect(normalizePushPreferences({ support: false })).toEqual({
      order: true,
      promotion: true,
      support: false,
      account: true,
      virtual_try_on: true,
      system: true,
    });
  });

  it('stores per-device preferences while registering a refreshed token', async () => {
    const lean = jest.fn().mockResolvedValue({ token: 'ExpoPushToken[token-1]' });
    mockedPushToken.findOneAndUpdate.mockReturnValue({ lean } as never);

    await registerPushToken(userId, {
      token: 'ExpoPushToken[token-1]',
      platform: 'android',
      preferences: { promotion: false },
    });

    expect(mockedPushToken.findOneAndUpdate).toHaveBeenCalledWith(
      { token: 'ExpoPushToken[token-1]' },
      {
        $set: expect.objectContaining({
          platform: 'android',
          isActive: true,
          preferences: expect.objectContaining({
            promotion: false,
            order: true,
            support: true,
          }),
        }),
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  });

  it('sends only to tokens that allow the notification category', async () => {
    mockTokenQuery([
      { token: 'ExpoPushToken[enabled]', preferences: { support: true } },
      { token: 'ExpoPushToken[disabled]', preferences: { support: false } },
    ]);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [{ status: 'ok' }] }),
    } as unknown as Response);

    await expect(sendCustomerPush({
      userId,
      category: 'support',
      title: 'Support',
      body: 'Reply',
      data: { type: 'support_reply' },
    })).resolves.toEqual({ sent: 1, failed: 0 });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const messages = JSON.parse(String(request.body)) as Array<{ to: string }>;
    expect(messages).toEqual([
      expect.objectContaining({ to: 'ExpoPushToken[enabled]' }),
    ]);
  });

  it('includes the persisted notification id so opening a push can mark it read', async () => {
    mockTokenQuery([
      { token: 'ExpoPushToken[enabled]', preferences: { support: true } },
    ]);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [{ status: 'ok' }] }),
    } as unknown as Response);

    await sendCustomerPush({
      userId,
      category: 'support',
      title: 'Support',
      body: 'Reply',
      data: { type: 'support_reply', ticketId: 'ticket-1' },
      notificationId: '665000000000000000000009',
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const messages = JSON.parse(String(request.body)) as Array<{ data: Record<string, unknown> }>;
    expect(messages[0].data).toEqual({
      type: 'support_reply',
      ticketId: 'ticket-1',
      notificationId: '665000000000000000000009',
    });
  });

  it('does not call Expo when every active token opted out of the category', async () => {
    mockTokenQuery([
      { token: 'ExpoPushToken[disabled]', preferences: { order: false } },
    ]);
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(sendCustomerPush({
      userId,
      category: 'order',
      title: 'Order',
      body: 'Updated',
      data: { type: 'shipping_update' },
    })).resolves.toEqual({ sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed Expo tokens before writing', async () => {
    await expect(registerPushToken(userId, {
      token: 'not-an-expo-token',
      platform: 'android',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPushToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an empty registration payload instead of throwing an internal error', async () => {
    await expect(registerPushToken(userId, null)).rejects.toMatchObject({
      message: 'Thiếu thông tin đăng ký nhận thông báo',
      statusCode: 400,
    });
    expect(mockedPushToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens when unregistering', async () => {
    await expect(unregisterPushToken(userId, '')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPushToken.updateOne).not.toHaveBeenCalled();
  });

  it('fails closed when Expo omits receipts and disables unregistered devices', async () => {
    mockTokenQuery([
      { token: 'ExpoPushToken[expired]', preferences: { support: true } },
      { token: 'ExpoPushToken[missing-receipt]', preferences: { support: true } },
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    } as unknown as Response);
    mockedPushToken.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);

    await expect(sendCustomerPush({
      userId,
      category: 'support',
      title: 'Support',
      body: 'Reply',
      data: { type: 'support_reply' },
    })).resolves.toEqual({ sent: 0, failed: 2 });

    expect(mockedPushToken.updateMany).toHaveBeenCalledWith(
      { token: { $in: ['ExpoPushToken[expired]'] } },
      { isActive: false },
    );
  });
});
