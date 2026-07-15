import { Types } from 'mongoose';
import { CustomerNotification } from '../../../database/models';
import {
  deleteVirtualTryOnJobNotifications,
  listCustomerNotifications,
  markAllCustomerNotificationsRead,
  recordOrderCreatedNotification,
  recordVirtualTryOnAccessNotification,
  recordVirtualTryOnOutcomeNotification,
} from '../customer-notification.service';

jest.mock('../../../database/models', () => ({
  CUSTOMER_NOTIFICATION_CATEGORIES: ['order', 'promotion', 'support', 'account', 'virtual_try_on', 'system'],
  CustomerNotification: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockedNotification = CustomerNotification as jest.Mocked<typeof CustomerNotification>;
const userId = '665000000000000000000001';

describe('customer notification service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists order-created notifications with a stable dedupe key and deep link', async () => {
    mockedNotification.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await recordOrderCreatedNotification({
      userId,
      orderId: '665000000000000000000010',
      orderCode: 'FS-1001',
      imageUrl: 'https://cdn.example.com/item.jpg',
    });

    expect(mockedNotification.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        dedupeKey: 'order:665000000000000000000010:created',
      }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          title: 'Đặt hàng thành công',
          action: expect.objectContaining({
            type: 'order_detail',
            entityId: '665000000000000000000010',
          }),
        }),
      }),
      expect.objectContaining({ upsert: true, returnDocument: 'after' }),
    );
  });

  it('returns cursor pagination and the global unread count', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      _id: new Types.ObjectId(`66500000000000000000001${index}`),
      title: `Notification ${index}`,
    }));
    const lean = jest.fn().mockResolvedValue(rows);
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    mockedNotification.find.mockReturnValue({ sort } as never);
    mockedNotification.countDocuments.mockResolvedValue(7);

    const result = await listCustomerNotifications({ userId, limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.unreadCount).toBe(7);
    expect(result.pagination).toEqual({
      limit: 2,
      hasMore: true,
      nextCursor: rows[1]._id.toString(),
    });
    expect(limit).toHaveBeenCalledWith(3);
  });

  it('marks only unread notifications belonging to the authenticated user', async () => {
    mockedNotification.updateMany.mockResolvedValue({ modifiedCount: 5 } as never);

    const result = await markAllCustomerNotificationsRead(userId);

    expect(result.updatedCount).toBe(5);
    expect(mockedNotification.updateMany).toHaveBeenCalledWith(
      { userId: expect.any(Types.ObjectId), isRead: false },
      { $set: { isRead: true, readAt: expect.any(Date) } },
    );
  });

  it('deletes only virtual try-on notifications linked to the deleted job', async () => {
    mockedNotification.deleteMany.mockResolvedValue({ deletedCount: 1 } as never);
    const jobId = '665000000000000000000020';

    const result = await deleteVirtualTryOnJobNotifications(userId, jobId);

    expect(result).toEqual({ deletedCount: 1 });
    expect(mockedNotification.deleteMany).toHaveBeenCalledWith({
      userId: expect.any(Types.ObjectId),
      category: 'virtual_try_on',
      $or: [
        { 'action.entityId': jobId },
        { 'data.jobId': jobId },
      ],
    });
  });

  it('keeps generated images actionable when only the video stage fails', async () => {
    mockedNotification.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await recordVirtualTryOnOutcomeNotification({
      userId,
      jobId: '665000000000000000000020',
      outcome: 'partial_video_failed',
      outputMode: 'image_and_video',
      generatedImageCount: 4,
      videoStatus: 'failed',
      errorCode: 'VIDEO_PROVIDER_FAILED',
      retryable: true,
    });

    expect(mockedNotification.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'virtual-try-on:665000000000000000000020:partial_video_failed:VIDEO_PROVIDER_FAILED',
      }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          category: 'virtual_try_on',
          type: 'virtual_try_on_partial',
          action: expect.objectContaining({
            type: 'virtual_try_on_result',
            entityId: '665000000000000000000020',
          }),
          data: expect.objectContaining({ generatedImageCount: 4, retryable: true }),
        }),
      }),
      expect.any(Object),
    );
  });

  it('uses neutral copy and a non-retry action for safety-blocked jobs', async () => {
    mockedNotification.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await recordVirtualTryOnOutcomeNotification({
      userId,
      jobId: '665000000000000000000021',
      outcome: 'policy_blocked',
      outputMode: 'image',
      generatedImageCount: 0,
      errorCode: 'PROVIDER_SAFETY_BLOCKED',
      retryable: false,
    });

    const inserted = mockedNotification.findOneAndUpdate.mock.calls[0]?.[1] as {
      $setOnInsert?: { title?: string; body?: string; action?: { type?: string }; data?: Record<string, unknown> };
    };
    expect(inserted.$setOnInsert).toMatchObject({
      title: 'Yêu cầu phối đồ không thể hoàn tất',
      action: { type: 'virtual_try_on_processing' },
      data: { retryable: false },
    });
    expect(inserted.$setOnInsert?.body).not.toMatch(/sexual|violence|explicit|child/i);
  });

  it('records a daily access notification without storing the violating prompt', async () => {
    mockedNotification.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);
    const blockedUntil = new Date('2026-07-15T16:59:59.000Z');

    await recordVirtualTryOnAccessNotification({
      userId,
      state: 'prompt_blocked',
      eventKey: `${userId}:prompt:2026-07-15`,
      blockedUntil,
    });

    const inserted = mockedNotification.findOneAndUpdate.mock.calls[0]?.[1] as {
      $setOnInsert?: { action?: { type?: string }; data?: Record<string, unknown> };
    };
    expect(inserted.$setOnInsert).toMatchObject({
      action: { type: 'virtual_try_on_home' },
      data: { accessState: 'prompt_blocked', blockedUntil: blockedUntil.toISOString() },
    });
    expect(inserted.$setOnInsert?.data).not.toHaveProperty('prompt');
  });
});
