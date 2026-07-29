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
} from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';

type CustomerActorRole = 'admin' | 'staff';

type CustomerActivityItem = {
  id: string;
  type:
    | 'account'
    | 'order'
    | 'support'
    | 'review'
    | 'interaction'
    | 'virtual_try_on'
    | 'audit';
  title: string;
  description: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
};

export class CustomerInsightServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CustomerInsightServiceError';
  }
}

const DEFAULT_ACTIVITY_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 50;
const DEFAULT_NOTE_LIMIT = 50;
const MAX_NOTE_LIMIT = 100;
const RECENT_ORDER_LIMIT = 5;

const toObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new CustomerInsightServiceError(`${fieldName} không hợp lệ`, 400);
  }

  return new Types.ObjectId(value);
};

const clampPositiveInteger = (
  value: number | undefined,
  fallback: number,
  maximum: number,
) => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new CustomerInsightServiceError('Tham số phân trang không hợp lệ', 400);
  }
  return Math.min(value, maximum);
};

const ensureCustomer = async (customerId: Types.ObjectId) => {
  const customer = await User.findOne({ _id: customerId, role: 'user' })
    .select('_id name email createdAt updatedAt lastLoginAt')
    .lean();

  if (!customer) {
    throw new CustomerInsightServiceError('Khách hàng không tồn tại', 404);
  }

  return customer;
};

const formatCurrency = (value: number) =>
  `${Math.round(value).toLocaleString('vi-VN')} đ`;

const getOrderStatusLabel = (status: string) => ({
  confirmed: 'đã xác nhận',
  packed: 'đã đóng gói',
  shipping: 'đang giao',
  delivered: 'đã giao',
  completed: 'hoàn tất',
  cancelled: 'đã hủy',
  return_requested: 'yêu cầu trả hàng',
  return_approved: 'đã duyệt trả hàng',
  returned: 'đã hoàn hàng',
}[status] ?? status);

const getInteractionLabel = (actionType: string) => ({
  search: 'Tìm kiếm sản phẩm',
  favorite: 'Thêm sản phẩm yêu thích',
  purchase: 'Ghi nhận mua hàng',
  recommendation_click: 'Mở sản phẩm được gợi ý',
  try_on: 'Thử phối đồ ảo',
}[actionType] ?? 'Tương tác sản phẩm');

const getCustomerInsights = async (input: {
  customerId: string;
  activityPage?: number;
  activityLimit?: number;
}) => {
  const customerId = toObjectId(input.customerId, 'customerId');
  const activityPage = clampPositiveInteger(input.activityPage, 1, 10_000);
  const activityLimit = clampPositiveInteger(
    input.activityLimit,
    DEFAULT_ACTIVITY_LIMIT,
    MAX_ACTIVITY_LIMIT,
  );
  const activityFetchLimit = Math.min(activityPage * activityLimit, 500);
  const customer = await ensureCustomer(customerId);

  const [
    orderStats,
    recentOrders,
    activityOrders,
    supportTickets,
    reviews,
    interactions,
    tryOnJobs,
    auditLogs,
    supportCount,
    reviewCount,
    interactionCount,
    tryOnCount,
    auditCount,
  ] = await Promise.all([
    Order.aggregate<{
      totalOrders: number;
      totalSpent: number;
      successfulOrders: number;
    }>([
      { $match: { user_id: customerId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$paymentStatus', 'paid'] },
                    { $not: [{ $in: ['$status', ['cancelled', 'returned']] }] },
                  ],
                },
                '$totalAmount',
                0,
              ],
            },
          },
          successfulOrders: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'completed']] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0, totalOrders: 1, totalSpent: 1, successfulOrders: 1 } },
    ]),
    Order.find({ user_id: customerId })
      .select('orderCode totalAmount status paymentMethod paymentStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(RECENT_ORDER_LIMIT)
      .lean(),
    Order.find({ user_id: customerId })
      .select('orderCode totalAmount status createdAt')
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .lean(),
    SupportTicket.find({ userId: customerId })
      .select('ticketCode subject status category createdAt')
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .lean(),
    Review.find({ user_id: customerId })
      .select('rating comment moderationStatus createdAt product_id')
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .lean(),
    UserProductInteraction.find({
      userId: customerId,
      actionType: {
        $in: ['search', 'favorite', 'purchase', 'recommendation_click', 'try_on'],
      },
    })
      .select('actionType source metadata productId createdAt')
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .lean(),
    VirtualTryOnJob.find({ userId: customerId, deletedAt: null })
      .select('status outfitMode selectedItems createdAt')
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .lean(),
    AuditLog.find({ targetType: 'User', targetId: customerId })
      .select('action actorId actorRole reason metadata createdAt')
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .lean(),
    SupportTicket.countDocuments({ userId: customerId }),
    Review.countDocuments({ user_id: customerId }),
    UserProductInteraction.countDocuments({
      userId: customerId,
      actionType: {
        $in: ['search', 'favorite', 'purchase', 'recommendation_click', 'try_on'],
      },
    }),
    VirtualTryOnJob.countDocuments({ userId: customerId, deletedAt: null }),
    AuditLog.countDocuments({ targetType: 'User', targetId: customerId }),
  ]);

  const accountActivity: CustomerActivityItem[] = [
    {
      id: `account-created-${customerId.toString()}`,
      type: 'account',
      title: 'Tạo tài khoản',
      description: customer.email,
      occurredAt: customer.createdAt,
    },
    ...(customer.lastLoginAt
      ? [{
          id: `account-login-${customerId.toString()}`,
          type: 'account' as const,
          title: 'Đăng nhập gần nhất',
          description: 'Phiên đăng nhập gần nhất được hệ thống ghi nhận',
          occurredAt: customer.lastLoginAt,
        }]
      : []),
  ];
  const activityItems: CustomerActivityItem[] = [
    ...accountActivity,
    ...activityOrders.map((order) => ({
      id: `order-${order._id.toString()}`,
      type: 'order' as const,
      title: `Đặt đơn ${order.orderCode}`,
      description: `${getOrderStatusLabel(order.status)} · ${formatCurrency(order.totalAmount)}`,
      occurredAt: order.createdAt,
      metadata: { orderId: order._id.toString(), orderCode: order.orderCode },
    })),
    ...supportTickets.map((ticket) => ({
      id: `support-${ticket._id.toString()}`,
      type: 'support' as const,
      title: `Yêu cầu ${ticket.ticketCode}`,
      description: `${ticket.subject} · ${ticket.status}`,
      occurredAt: ticket.createdAt,
      metadata: { ticketId: ticket._id.toString(), ticketCode: ticket.ticketCode },
    })),
    ...reviews.map((review) => ({
      id: `review-${review._id.toString()}`,
      type: 'review' as const,
      title: `Đánh giá ${review.rating}/5`,
      description: review.comment.slice(0, 160),
      occurredAt: review.createdAt,
      metadata: {
        reviewId: review._id.toString(),
        productId: review.product_id.toString(),
        moderationStatus: review.moderationStatus,
      },
    })),
    ...interactions.map((interaction) => ({
      id: `interaction-${interaction._id.toString()}`,
      type: 'interaction' as const,
      title: getInteractionLabel(interaction.actionType),
      description: `Nguồn: ${interaction.source}`,
      occurredAt: interaction.createdAt,
      metadata: {
        actionType: interaction.actionType,
        source: interaction.source,
        ...(interaction.productId ? { productId: interaction.productId.toString() } : {}),
      },
    })),
    ...tryOnJobs.map((job) => ({
      id: `try-on-${job._id.toString()}`,
      type: 'virtual_try_on' as const,
      title: 'Phối đồ ảo',
      description: `${job.selectedItems.length} sản phẩm · ${job.status}`,
      occurredAt: job.createdAt,
      metadata: { jobId: job._id.toString(), status: job.status },
    })),
    ...auditLogs.map((log) => ({
      id: `audit-${log._id.toString()}`,
      type: 'audit' as const,
      title: `Quản trị: ${log.action}`,
      description: log.reason || `Thực hiện bởi ${log.actorRole}`,
      occurredAt: log.createdAt,
      metadata: {
        action: log.action,
        actorRole: log.actorRole,
        ...(log.actorId ? { actorId: log.actorId.toString() } : {}),
      },
    })),
  ].sort((first, second) => second.occurredAt.getTime() - first.occurredAt.getTime());
  const totalActivityItems =
    accountActivity.length +
    (orderStats[0]?.totalOrders ?? 0) +
    supportCount +
    reviewCount +
    interactionCount +
    tryOnCount +
    auditCount;
  const activityStart = (activityPage - 1) * activityLimit;

  return {
    orders: {
      totalOrders: orderStats[0]?.totalOrders ?? 0,
      successfulOrders: orderStats[0]?.successfulOrders ?? 0,
      totalSpent: orderStats[0]?.totalSpent ?? 0,
      recentOrders: recentOrders.map((order) => ({
        _id: order._id.toString(),
        orderCode: order.orderCode,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      })),
    },
    activity: {
      items: activityItems.slice(activityStart, activityStart + activityLimit),
      pagination: {
        page: activityPage,
        limit: activityLimit,
        totalItems: totalActivityItems,
        totalPages: Math.ceil(totalActivityItems / activityLimit),
      },
    },
  };
};

const normalizeNoteContent = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new CustomerInsightServiceError('Nội dung ghi chú là bắt buộc', 400);
  }

  const content = value.trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  if (!content || content.length > 2000) {
    throw new CustomerInsightServiceError('Ghi chú phải từ 1 đến 2000 ký tự', 400);
  }

  return content;
};

const listCustomerNotes = async (input: {
  customerId: string;
  limit?: number;
}) => {
  const customerId = toObjectId(input.customerId, 'customerId');
  const limit = clampPositiveInteger(input.limit, DEFAULT_NOTE_LIMIT, MAX_NOTE_LIMIT);
  await ensureCustomer(customerId);

  return CustomerNote.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();
};

const createCustomerNote = async (input: {
  customerId: string;
  content: unknown;
  actorId: string;
  actorRole: CustomerActorRole;
}) => {
  const customerId = toObjectId(input.customerId, 'customerId');
  const actorId = toObjectId(input.actorId, 'actorId');
  const content = normalizeNoteContent(input.content);
  await ensureCustomer(customerId);

  const note = await CustomerNote.create({
    customerId,
    content,
    createdBy: actorId,
    updatedBy: actorId,
  });

  await auditLogService.recordAuditLogBestEffort({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'customer_note.create',
    targetType: 'User',
    targetId: input.customerId,
    after: { noteId: note._id.toString(), content },
  });

  return CustomerNote.findById(note._id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();
};

const updateCustomerNote = async (input: {
  customerId: string;
  noteId: string;
  content: unknown;
  actorId: string;
  actorRole: CustomerActorRole;
}) => {
  const customerId = toObjectId(input.customerId, 'customerId');
  const noteId = toObjectId(input.noteId, 'noteId');
  const actorId = toObjectId(input.actorId, 'actorId');
  const content = normalizeNoteContent(input.content);
  const previousNote = await CustomerNote.findOne({ _id: noteId, customerId }).lean();

  if (!previousNote) {
    throw new CustomerInsightServiceError('Ghi chú không tồn tại', 404);
  }

  await CustomerNote.updateOne(
    { _id: noteId, customerId },
    { $set: { content, updatedBy: actorId } },
  );
  await auditLogService.recordAuditLogBestEffort({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'customer_note.update',
    targetType: 'User',
    targetId: input.customerId,
    before: { noteId: input.noteId, content: previousNote.content },
    after: { noteId: input.noteId, content },
  });

  return CustomerNote.findById(noteId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();
};

const deleteCustomerNote = async (input: {
  customerId: string;
  noteId: string;
  actorId: string;
  actorRole: CustomerActorRole;
}) => {
  const customerId = toObjectId(input.customerId, 'customerId');
  const noteId = toObjectId(input.noteId, 'noteId');
  const note = await CustomerNote.findOneAndDelete({ _id: noteId, customerId }).lean();

  if (!note) {
    throw new CustomerInsightServiceError('Ghi chú không tồn tại', 404);
  }

  await auditLogService.recordAuditLogBestEffort({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'customer_note.delete',
    targetType: 'User',
    targetId: input.customerId,
    before: { noteId: input.noteId, content: note.content },
  });

  return { deleted: true };
};

export const customerInsightService = {
  createCustomerNote,
  deleteCustomerNote,
  getCustomerInsights,
  listCustomerNotes,
  updateCustomerNote,
};
