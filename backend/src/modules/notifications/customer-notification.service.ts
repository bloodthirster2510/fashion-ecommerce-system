import { Types } from 'mongoose';
import {
  CUSTOMER_NOTIFICATION_CATEGORIES,
  CustomerNotification,
  type CustomerNotificationAction,
  type CustomerNotificationCategory,
  type CustomerNotificationType,
} from '../../database/models';
import { storefrontSettingsService } from '../storefront-settings/storefront-settings.service';

export class CustomerNotificationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CustomerNotificationServiceError';
  }
}

export type CreateCustomerNotificationInput = {
  userId: string;
  category: CustomerNotificationCategory;
  type: CustomerNotificationType;
  title: string;
  body: string;
  imageUrl?: string | null;
  action?: {
    type: CustomerNotificationAction;
    label?: string | null;
    entityId?: string | null;
  } | null;
  data?: Record<string, unknown>;
  dedupeKey?: string | null;
};

type OrderNotificationInput = {
  userId: string;
  orderId: string;
  orderCode: string;
  imageUrl?: string | null;
};

export type VirtualTryOnNotificationOutcome =
  | 'completed'
  | 'partial_video_failed'
  | 'failed'
  | 'policy_blocked'
  | 'admin_canceled';

export type VirtualTryOnOutcomeNotificationInput = {
  userId: string;
  jobId: string;
  outcome: VirtualTryOnNotificationOutcome;
  outputMode: 'image' | 'image_and_video';
  generatedImageCount: number;
  imageUrl?: string | null;
  videoStatus?: string | null;
  errorCode?: string | null;
  retryable: boolean;
};

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

const toObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    const label = {
      userId: 'Người dùng',
      cursor: 'Mốc phân trang',
      notificationId: 'Thông báo',
    }[fieldName] ?? 'Dữ liệu';
    throw new CustomerNotificationServiceError(`${label} không hợp lệ`, 400);
  }
  return new Types.ObjectId(value);
};

const normalizeText = (value: string, fieldName: string, maxLength: number) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > maxLength) {
    const label = fieldName === 'title' ? 'Tiêu đề' : 'Nội dung';
    throw new CustomerNotificationServiceError(`${label} thông báo không hợp lệ`, 400);
  }
  return normalized;
};

const clampLimit = (value?: number) => {
  if (value === undefined) return DEFAULT_LIST_LIMIT;
  if (!Number.isInteger(value) || value < 1) {
    throw new CustomerNotificationServiceError('Số lượng thông báo không hợp lệ', 400);
  }
  return Math.min(value, MAX_LIST_LIMIT);
};

const isCategory = (value: string): value is CustomerNotificationCategory =>
  CUSTOMER_NOTIFICATION_CATEGORIES.includes(value as CustomerNotificationCategory);

const isDuplicateKeyError = (error: unknown) => Boolean(
  error && typeof error === 'object' && 'code' in error &&
  (error as { code?: unknown }).code === 11000,
);

export const createCustomerNotification = async (input: CreateCustomerNotificationInput) => {
  const userId = toObjectId(input.userId, 'userId');
  const title = normalizeText(input.title, 'title', 120);
  const body = normalizeText(input.body, 'body', 500);
  const dedupeKey = input.dedupeKey?.trim() || null;

  if (dedupeKey && dedupeKey.length > 180) {
    throw new CustomerNotificationServiceError('Mã chống trùng thông báo không hợp lệ', 400);
  }

  const payload = {
    userId,
    category: input.category,
    type: input.type,
    title,
    body,
    imageUrl: input.imageUrl?.trim() || null,
    action: input.action ?? null,
    data: input.data ?? {},
    dedupeKey,
  };

  if (!dedupeKey) {
    return CustomerNotification.create(payload);
  }

  try {
    return await CustomerNotification.findOneAndUpdate(
      { userId, dedupeKey },
      { $setOnInsert: payload },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return CustomerNotification.findOne({ userId, dedupeKey });
  }
};

export const createCustomerNotificationBestEffort = async (
  input: CreateCustomerNotificationInput,
  context = 'Failed to persist customer notification',
) => {
  try {
    return await createCustomerNotification(input);
  } catch (error) {
    console.warn(`${context}:`, error);
    return null;
  }
};

export const listCustomerNotifications = async (input: {
  userId: string;
  limit?: number;
  cursor?: string;
  category?: string;
  unreadOnly?: boolean;
}) => {
  const userId = toObjectId(input.userId, 'userId');
  const limit = clampLimit(input.limit);
  const filter: Record<string, unknown> = { userId };

  if (input.cursor) filter._id = { $lt: toObjectId(input.cursor, 'cursor') };
  if (input.category) {
    if (!isCategory(input.category)) {
      throw new CustomerNotificationServiceError('Loại thông báo không hợp lệ', 400);
    }
    filter.category = input.category;
  }
  if (input.unreadOnly) filter.isRead = false;

  const [rows, unreadCount] = await Promise.all([
    CustomerNotification.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean(),
    CustomerNotification.countDocuments({ userId, isRead: false }),
  ]);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore && items.length ? items[items.length - 1]._id.toString() : null,
    },
    unreadCount,
  };
};

export const markCustomerNotificationRead = async (userId: string, notificationId: string) => {
  const notification = await CustomerNotification.findOneAndUpdate(
    {
      _id: toObjectId(notificationId, 'notificationId'),
      userId: toObjectId(userId, 'userId'),
    },
    [{
      $set: {
        isRead: true,
        readAt: {
          $cond: [
            { $eq: ['$isRead', true] },
            { $ifNull: ['$readAt', '$$NOW'] },
            '$$NOW',
          ],
        },
      },
    }],
    { returnDocument: 'after', runValidators: true, updatePipeline: true },
  ).lean();

  if (!notification) {
    throw new CustomerNotificationServiceError('Không tìm thấy thông báo', 404);
  }
  return notification;
};

export const markAllCustomerNotificationsRead = async (userId: string) => {
  const readAt = new Date();
  const result = await CustomerNotification.updateMany(
    { userId: toObjectId(userId, 'userId'), isRead: false },
    { $set: { isRead: true, readAt } },
  );
  return { updatedCount: result.modifiedCount, readAt };
};

export const deleteVirtualTryOnJobNotifications = async (userId: string, jobId: string) => {
  const normalizedJobId = jobId.trim();
  if (!normalizedJobId) {
    throw new CustomerNotificationServiceError('Yêu cầu phối đồ không hợp lệ', 400);
  }

  const result = await CustomerNotification.deleteMany({
    userId: toObjectId(userId, 'userId'),
    category: 'virtual_try_on',
    $or: [
      { 'action.entityId': normalizedJobId },
      { 'data.jobId': normalizedJobId },
    ],
  });

  return { deletedCount: result.deletedCount };
};

const orderAction = (orderId: string) => ({
  type: 'order_detail' as const,
  label: 'Xem đơn',
  entityId: orderId,
});

export const recordOrderCreatedNotification = (input: OrderNotificationInput) =>
  createCustomerNotificationBestEffort({
    ...input,
    category: 'order',
    type: 'order_status',
    title: 'Shop đã nhận đơn hàng',
    body: `Đơn ${input.orderCode} đang chờ shop xác nhận.`,
    action: orderAction(input.orderId),
    data: { orderId: input.orderId, orderCode: input.orderCode, status: 'confirmed' },
    dedupeKey: `order:${input.orderId}:created`,
  });

const orderStatusCopy: Partial<Record<string, {
  title: string;
  body: (code: string, context?: { shopName: string }) => string;
}>> = {
  packed: {
    title: 'Đơn đã đóng gói',
    body: (code) => `Đơn ${code} đang chờ bàn giao cho đơn vị vận chuyển.`,
  },
  completed: {
    title: 'Đơn hàng đã hoàn tất',
    body: (code, context) => `Đơn ${code} đã hoàn tất. Cảm ơn bạn đã mua sắm cùng ${context?.shopName || 'CDShop'}.`,
  },
  cancelled: {
    title: 'Đơn hàng đã bị hủy',
    body: (code) => `Đơn ${code} đã bị hủy. Xem chi tiết để biết lý do.`,
  },
  payment_expired: {
    title: 'Đơn đã bị hủy',
    body: (code) => `Đơn ${code} đã bị hủy vì quá hạn thanh toán.`,
  },
  return_requested: {
    title: 'Đã gửi yêu cầu trả hàng',
    body: (code) => `Shop đang xem yêu cầu trả hàng của đơn ${code}.`,
  },
  return_approved: {
    title: 'Shop đã duyệt yêu cầu trả hàng',
    body: (code) => `Xem chi tiết đơn ${code} để biết bước tiếp theo.`,
  },
  return_rejected: {
    title: 'Shop chưa thể duyệt yêu cầu trả hàng',
    body: (code) => `Xem chi tiết đơn ${code} để biết lý do.`,
  },
  returned: {
    title: 'Đã trả hàng xong',
    body: (code) => `Đơn ${code} đã hoàn tất trả hàng.`,
  },
};

export const recordOrderStatusNotification = async (input: OrderNotificationInput & { status: string }) => {
  const copy = orderStatusCopy[input.status];
  if (!copy) return null;

  const shopName = input.status === 'completed'
    ? await storefrontSettingsService.getPublicSettings()
      .then((settings) => settings.identity.name)
      .catch(() => 'CDShop')
    : 'CDShop';

  return createCustomerNotificationBestEffort({
    ...input,
    category: 'order',
    type: 'order_status',
    title: copy.title,
    body: copy.body(input.orderCode, { shopName }),
    action: orderAction(input.orderId),
    data: { orderId: input.orderId, orderCode: input.orderCode, status: input.status },
    dedupeKey: `order:${input.orderId}:status:${input.status}`,
  });
};

const paymentStatusCopy: Partial<Record<string, { title: string; body: (code: string) => string }>> = {
  paid: {
    title: 'Đã thanh toán',
    body: (code) => `Shop đã xác nhận thanh toán cho đơn ${code}.`,
  },
  failed: {
    title: 'Chưa thanh toán được',
    body: (code) => `Bạn có thể thử thanh toán lại đơn ${code} trong phần chi tiết.`,
  },
  refunded: {
    title: 'Đã hoàn tiền',
    body: (code) => `Tiền của đơn ${code} đã được hoàn lại.`,
  },
};

export const recordOrderPaymentNotification = (input: OrderNotificationInput & { paymentStatus: string }) => {
  const copy = paymentStatusCopy[input.paymentStatus];
  if (!copy) return Promise.resolve(null);

  return createCustomerNotificationBestEffort({
    ...input,
    category: 'order',
    type: 'payment_status',
    title: copy.title,
    body: copy.body(input.orderCode),
    action: orderAction(input.orderId),
    data: {
      orderId: input.orderId,
      orderCode: input.orderCode,
      paymentStatus: input.paymentStatus,
    },
    dedupeKey: `order:${input.orderId}:payment:${input.paymentStatus}`,
  });
};

export const recordLoyaltyEarnedNotification = (
  input: OrderNotificationInput & { points: number },
) => {
  if (!Number.isInteger(input.points) || input.points <= 0) return Promise.resolve(null);
  return createCustomerNotificationBestEffort({
    ...input,
    category: 'account',
    type: 'loyalty',
    title: `Bạn vừa nhận ${input.points.toLocaleString('vi-VN')} điểm`,
    body: `Điểm thành viên từ đơn ${input.orderCode} đã được cộng vào tài khoản.`,
    action: { type: 'membership', label: 'Xem điểm' },
    data: { orderId: input.orderId, orderCode: input.orderCode, points: input.points },
    dedupeKey: `order:${input.orderId}:loyalty:${input.points}`,
  });
};

const virtualTryOnOutcomeCopy = (input: VirtualTryOnOutcomeNotificationInput) => {
  switch (input.outcome) {
    case 'completed':
      return input.outputMode === 'image_and_video'
        ? {
            type: 'virtual_try_on_completed' as const,
            title: 'Ảnh và video phối đồ đã xong',
            body: 'Xem kết quả để lưu hoặc chia sẻ.',
          }
        : {
            type: 'virtual_try_on_completed' as const,
            title: 'Ảnh phối đồ đã xong',
            body: input.generatedImageCount > 1
              ? `Đã tạo ${input.generatedImageCount} ảnh phối đồ cho bạn.`
              : 'Ảnh phối đồ của bạn đã xong.',
          };
    case 'partial_video_failed':
      return {
        type: 'virtual_try_on_partial' as const,
        title: 'Ảnh đã xong, video chưa tạo được',
        body: input.retryable
          ? 'Bạn vẫn có thể xem ảnh và thử tạo lại video.'
          : 'Video chưa tạo được nhưng ảnh vẫn được giữ lại.',
      };
    case 'policy_blocked':
      return {
        type: 'virtual_try_on_policy' as const,
        title: 'Chưa thể tạo ảnh phối đồ',
        body: 'Bạn hãy chọn ảnh hoặc sản phẩm khác rồi thử lại.',
      };
    case 'admin_canceled':
      return {
        type: 'virtual_try_on_failed' as const,
        title: input.generatedImageCount > 0 ? 'Video phối đồ đã dừng' : 'Yêu cầu phối đồ đã dừng',
        body: input.generatedImageCount > 0
          ? 'Ảnh đã tạo vẫn được giữ trong lịch sử phối đồ.'
          : 'Bạn có thể tạo một yêu cầu mới.',
      };
    default:
      return {
        type: 'virtual_try_on_failed' as const,
        title: 'Chưa tạo được ảnh phối đồ',
        body: 'Có lỗi khi xử lý. Bạn có thể mở lại và thử lần nữa.',
      };
  }
};

export const recordVirtualTryOnOutcomeNotification = async (
  input: VirtualTryOnOutcomeNotificationInput,
) => {
  const copy = virtualTryOnOutcomeCopy(input);
  const opensResult = input.outcome === 'completed' ||
    input.outcome === 'partial_video_failed' ||
    (input.outcome === 'admin_canceled' && input.generatedImageCount > 0);
  const dedupeSuffix = input.outcome === 'completed'
    ? `${input.outcome}:${input.outputMode}`
    : `${input.outcome}:${input.errorCode?.trim() || input.videoStatus?.trim() || 'none'}`;

  return createCustomerNotificationBestEffort({
    userId: input.userId,
    category: 'virtual_try_on',
    type: copy.type,
    title: copy.title,
    body: copy.body,
    imageUrl: opensResult ? input.imageUrl : null,
    action: {
      type: opensResult ? 'virtual_try_on_result' : 'virtual_try_on_processing',
      label: opensResult ? 'Xem kết quả' : input.retryable ? 'Thử lại' : 'Xem chi tiết',
      entityId: input.jobId,
    },
    data: {
      jobId: input.jobId,
      outcome: input.outcome,
      outputMode: input.outputMode,
      generatedImageCount: Math.max(0, Math.floor(input.generatedImageCount)),
      videoStatus: input.videoStatus ?? null,
      errorCode: input.errorCode ?? null,
      retryable: input.retryable,
    },
    dedupeKey: `virtual-try-on:${input.jobId}:${dedupeSuffix}`,
  });
};

const formatVirtualTryOnBlockUntil = (value: Date) => value.toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const recordVirtualTryOnAccessNotification = (input: {
  userId: string;
  state: 'locked' | 'unlocked' | 'prompt_blocked';
  eventKey: string;
  blockedUntil?: Date | null;
}) => {
  const copy = input.state === 'unlocked'
    ? {
        title: 'Bạn có thể phối đồ trở lại',
        body: 'Tính năng phối đồ đã được mở lại.',
      }
    : input.state === 'prompt_blocked' && input.blockedUntil
      ? {
          title: 'Tạm khóa tính năng phối đồ',
          body: `Bạn có thể dùng lại sau ${formatVirtualTryOnBlockUntil(input.blockedUntil)}.`,
        }
      : {
          title: 'Tạm khóa tính năng phối đồ',
          body: 'Tài khoản của bạn đang tạm thời chưa dùng được tính năng này.',
        };

  return createCustomerNotificationBestEffort({
    userId: input.userId,
    category: 'virtual_try_on',
    type: 'virtual_try_on_access',
    title: copy.title,
    body: copy.body,
    action: { type: 'virtual_try_on_home', label: 'Mở phòng phối đồ' },
    data: {
      accessState: input.state,
      blockedUntil: input.blockedUntil?.toISOString() ?? null,
    },
    dedupeKey: `virtual-try-on:access:${input.eventKey}`,
  });
};

export const customerNotificationService = {
  create: createCustomerNotification,
  createBestEffort: createCustomerNotificationBestEffort,
  list: listCustomerNotifications,
  markRead: markCustomerNotificationRead,
  markAllRead: markAllCustomerNotificationsRead,
  deleteVirtualTryOnJobNotifications,
  recordOrderCreated: recordOrderCreatedNotification,
  recordOrderStatus: recordOrderStatusNotification,
  recordOrderPayment: recordOrderPaymentNotification,
  recordLoyaltyEarned: recordLoyaltyEarnedNotification,
  recordVirtualTryOnOutcome: recordVirtualTryOnOutcomeNotification,
  recordVirtualTryOnAccess: recordVirtualTryOnAccessNotification,
};
