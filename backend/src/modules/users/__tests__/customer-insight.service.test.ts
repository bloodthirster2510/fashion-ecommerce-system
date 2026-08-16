import { Types } from 'mongoose';
import {
  AuditLog,
  CustomerNote,
  Order,
  Review,
  SupportTicket,
  User,
  UserProductInteraction,
  VirtualTryOnJob,
} from '../../../database/models';
import { auditLogService } from '../../audit-logs/audit-log.service';
import { customerInsightService } from '../customer-insight.service';

jest.mock('../../../database/models', () => ({
  AuditLog: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
  CustomerNote: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    updateOne: jest.fn(),
  },
  Order: {
    aggregate: jest.fn(),
    find: jest.fn(),
  },
  Review: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
  SupportTicket: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
  UserProductInteraction: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
  VirtualTryOnJob: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

const queryWithLean = <T>(value: T) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

describe('customerInsightService', () => {
  const customerId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const customer = {
    _id: customerId,
    name: 'Anna',
    email: 'anna@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    lastLoginAt: new Date('2026-01-03T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (User.findOne as jest.Mock).mockReturnValue(queryWithLean(customer));
    (auditLogService.recordAuditLogBestEffort as jest.Mock).mockResolvedValue(undefined);
  });

  it('creates an audited note and returns populated author details', async () => {
    const noteId = new Types.ObjectId();
    const populatedNote = {
      _id: noteId,
      customerId,
      content: 'Khách ưu tiên email',
      createdBy: { _id: actorId, name: 'Admin' },
      updatedBy: { _id: actorId, name: 'Admin' },
    };
    (CustomerNote.create as jest.Mock).mockResolvedValue({ _id: noteId });
    (CustomerNote.findById as jest.Mock).mockReturnValue(queryWithLean(populatedNote));

    await expect(
      customerInsightService.createCustomerNote({
        customerId: customerId.toString(),
        content: '  Khách   ưu tiên email  ',
        actorId: actorId.toString(),
        actorRole: 'admin',
      }),
    ).resolves.toEqual(populatedNote);

    expect(CustomerNote.create).toHaveBeenCalledWith({
      customerId,
      content: 'Khách ưu tiên email',
      createdBy: actorId,
      updatedBy: actorId,
    });
    expect(auditLogService.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'customer_note.create',
        targetType: 'User',
        targetId: customerId.toString(),
      }),
    );
  });

  it('combines customer sources into a paginated timeline', async () => {
    const orderId = new Types.ObjectId();
    const supportId = new Types.ObjectId();
    const order = {
      _id: orderId,
      orderCode: 'ORD-1',
      totalAmount: 250000,
      status: 'completed',
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    };
    const support = {
      _id: supportId,
      ticketCode: 'TK-1',
      subject: 'Cần hỗ trợ đơn',
      status: 'open',
      category: 'orders',
      createdAt: new Date('2026-01-04T00:00:00.000Z'),
    };
    const audit = {
      _id: new Types.ObjectId(),
      action: 'customer.status_update',
      actorId: {
        _id: actorId,
        name: 'Quản trị An',
        email: 'admin@example.com',
        avatarImage: 'https://cdn.example.com/admin.jpg',
        role: 'admin',
      },
      actorRole: 'admin',
      reason: null,
      before: { isActive: true },
      after: { isActive: false },
      metadata: {},
      createdAt: new Date('2026-01-06T00:00:00.000Z'),
    };
    const interaction = {
      _id: new Types.ObjectId(),
      actionType: 'recommendation_click',
      source: 'product_detail',
      metadata: {},
      productId: new Types.ObjectId(),
      createdAt: new Date('2026-01-03T18:00:00.000Z'),
    };
    const tryOnJob = {
      _id: new Types.ObjectId(),
      status: 'processing',
      outfitMode: 'single',
      selectedItems: [{ productId: new Types.ObjectId() }],
      createdAt: new Date('2026-01-03T12:00:00.000Z'),
    };

    (Order.aggregate as jest.Mock).mockResolvedValue([
      { totalOrders: 1, successfulOrders: 1, totalSpent: 250000 },
    ]);
    (Order.find as jest.Mock)
      .mockReturnValueOnce(queryWithLean([order]))
      .mockReturnValueOnce(queryWithLean([order]));
    (SupportTicket.find as jest.Mock).mockReturnValue(queryWithLean([support]));
    (Review.find as jest.Mock).mockReturnValue(queryWithLean([]));
    (UserProductInteraction.find as jest.Mock).mockReturnValue(queryWithLean([interaction]));
    (VirtualTryOnJob.find as jest.Mock).mockReturnValue(queryWithLean([tryOnJob]));
    (AuditLog.find as jest.Mock).mockReturnValue(queryWithLean([audit]));
    (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(1);
    (Review.countDocuments as jest.Mock).mockResolvedValue(0);
    (UserProductInteraction.countDocuments as jest.Mock).mockResolvedValue(1);
    (VirtualTryOnJob.countDocuments as jest.Mock).mockResolvedValue(1);
    (AuditLog.countDocuments as jest.Mock).mockResolvedValue(1);

    const result = await customerInsightService.getCustomerInsights({
      customerId: customerId.toString(),
      activityPage: 1,
      activityLimit: 10,
    });

    expect(result.orders).toMatchObject({
      totalOrders: 1,
      successfulOrders: 1,
      totalSpent: 250000,
    });
    expect(result.activity.items.map((item) => item.type)).toEqual([
      'audit',
      'order',
      'support',
      'interaction',
      'virtual_try_on',
      'account',
      'account',
    ]);
    expect(result.activity.items[0]).toMatchObject({
      title: 'Đã khóa tài khoản',
      description: 'Quản trị An · Quản trị viên',
      actor: {
        name: 'Quản trị An',
        avatarImage: 'https://cdn.example.com/admin.jpg',
      },
    });
    expect(result.activity.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'support',
        description: 'Cần hỗ trợ đơn · Đã tiếp nhận',
      }),
      expect.objectContaining({
        type: 'interaction',
        description: 'Trang chi tiết sản phẩm',
      }),
      expect.objectContaining({
        type: 'virtual_try_on',
        description: '1 sản phẩm · Đang xử lý',
      }),
    ]));
    expect(result.activity.pagination.totalItems).toBe(7);
  });

  it('rejects invalid note content before writing', async () => {
    await expect(
      customerInsightService.createCustomerNote({
        customerId: customerId.toString(),
        content: '   ',
        actorId: actorId.toString(),
        actorRole: 'staff',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(CustomerNote.create).not.toHaveBeenCalled();
  });
});
