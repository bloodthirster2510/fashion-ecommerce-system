import { Types } from 'mongoose';
import {
  CUSTOMER_NOTIFICATION_CATEGORIES,
  PushToken,
  type CustomerNotificationCategory,
  type PushNotificationPreferences,
} from '../../database/models';
import { createCustomerNotificationBestEffort } from './customer-notification.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const expoTokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

type ExpoPushMessage = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};

const defaultPushPreferences = Object.fromEntries(
  CUSTOMER_NOTIFICATION_CATEGORIES.map((category) => [category, true]),
) as Record<CustomerNotificationCategory, boolean>;

export const normalizePushPreferences = (value: unknown): Record<CustomerNotificationCategory, boolean> => {
  const input = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    CUSTOMER_NOTIFICATION_CATEGORIES.map((category) => [
      category,
      typeof input[category] === 'boolean' ? input[category] : defaultPushPreferences[category],
    ]),
  ) as Record<CustomerNotificationCategory, boolean>;
};

const deliverExpoPush = async (
  userId: string,
  message: ExpoPushMessage,
  disabled = false,
  category: CustomerNotificationCategory = 'system',
) => {
  if (disabled || !Types.ObjectId.isValid(userId)) return { sent: 0 };

  const tokens = await PushToken.find({ userId: new Types.ObjectId(userId), isActive: true })
    .select('token preferences')
    .lean<Array<{ token: string; preferences?: PushNotificationPreferences }>>();
  const eligibleTokens = tokens.filter(({ preferences }) => preferences?.[category] !== false);
  if (!eligibleTokens.length) return { sent: 0 };

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(eligibleTokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      ...message,
    }))),
  });
  if (!response.ok) throw new Error(`Expo push request failed with status ${response.status}`);

  const payload = await response.json() as {
    data?: Array<{ status?: string; details?: { error?: string } }>;
  };
  const receipts = Array.isArray(payload.data) ? payload.data : [];
  const invalidTokens = eligibleTokens.filter(
    (_, index) => receipts[index]?.details?.error === 'DeviceNotRegistered',
  );
  if (invalidTokens.length) {
    await PushToken.updateMany(
      { token: { $in: invalidTokens.map((item) => item.token) } },
      { isActive: false },
    );
  }
  // A missing or malformed receipt must not be reported as a successful delivery.
  const failed = eligibleTokens.filter((_, index) => receipts[index]?.status !== 'ok').length;
  return { sent: eligibleTokens.length - failed, failed };
};

export const sendCustomerPush = (input: {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  notificationId?: string | null;
  category?: CustomerNotificationCategory;
  disabled?: boolean;
}) => deliverExpoPush(input.userId, {
  title: input.title,
  body: input.body,
  data: input.notificationId?.trim()
    ? { ...input.data, notificationId: input.notificationId.trim() }
    : input.data,
}, input.disabled, input.category);

export const registerPushToken = async (
  userId: string,
  input: { token?: string; platform?: string; preferences?: unknown } | null | undefined,
) => {
  if (!Types.ObjectId.isValid(userId)) throw Object.assign(new Error('Người dùng không hợp lệ'), { statusCode: 400 });
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Thiếu thông tin đăng ký nhận thông báo'), { statusCode: 400 });
  }
  const token = input.token?.trim() ?? '';
  if (!expoTokenPattern.test(token)) throw Object.assign(new Error('Thông tin nhận thông báo không hợp lệ'), { statusCode: 400 });
  if (!input.platform || !['ios', 'android'].includes(input.platform)) {
    throw Object.assign(new Error('Thiết bị không được hỗ trợ'), { statusCode: 400 });
  }

  return PushToken.findOneAndUpdate(
    { token },
    {
      $set: {
        userId: new Types.ObjectId(userId),
        platform: input.platform,
        preferences: normalizePushPreferences(input.preferences),
        isActive: true,
        lastUsedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();
};

export const unregisterPushToken = async (userId: string, token: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error('Người dùng không hợp lệ'), { statusCode: 400 });
  }
  const normalizedToken = token?.trim() ?? '';
  if (!expoTokenPattern.test(normalizedToken)) {
    throw Object.assign(new Error('Thông tin nhận thông báo không hợp lệ'), { statusCode: 400 });
  }
  const result = await PushToken.updateOne(
    { userId: new Types.ObjectId(userId), token: normalizedToken },
    { isActive: false },
  );
  return { disabled: result.modifiedCount > 0 };
};

export const sendSupportReplyPush = async (input: {
  userId: string;
  ticketId: string;
  ticketCode: string;
  subject: string;
  messageId?: string;
}) => {
  if (!Types.ObjectId.isValid(input.userId)) return { sent: 0 };
  const title = `Shop đã phản hồi ${input.ticketCode}`;
  const body = input.subject;
  const data = { type: 'support_reply', ticketId: input.ticketId };

  const notification = await createCustomerNotificationBestEffort({
    userId: input.userId,
    category: 'support',
    type: 'support_reply',
    title,
    body,
    action: {
      type: 'support_ticket_detail',
      label: 'Xem phản hồi',
      entityId: input.ticketId,
    },
    data: { ...data, ticketCode: input.ticketCode },
    dedupeKey: input.messageId ? `support:${input.messageId}` : null,
  });

  return sendCustomerPush({
    userId: input.userId,
    title,
    body,
    data,
    notificationId: notification ? String(notification._id) : undefined,
    disabled: process.env.SUPPORT_PUSH_NOTIFICATIONS === 'false',
    category: 'support',
  });
};

export const sendPaymentDeadlineWarningPush = async (input: {
  userId: string;
  orderId: string;
  orderCode: string;
  paymentDeadlineAt: Date;
}) => {
  if (!Types.ObjectId.isValid(input.userId)) return { sent: 0 };
  const title = `Đơn ${input.orderCode} sắp bị hủy`;
  const deadline = input.paymentDeadlineAt.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const body = `Thanh toán trước ${deadline} để giữ hàng.`;
  const data = {
    type: 'payment_deadline',
    orderId: input.orderId,
    paymentDeadlineAt: input.paymentDeadlineAt.toISOString(),
  };

  const notification = await createCustomerNotificationBestEffort({
    userId: input.userId,
    category: 'order',
    type: 'payment_deadline',
    title,
    body,
    action: { type: 'order_detail', label: 'Thanh toán ngay', entityId: input.orderId },
    data: { ...data, orderCode: input.orderCode },
    dedupeKey: `order:${input.orderId}:payment-deadline`,
  });

  return sendCustomerPush({
    userId: input.userId,
    title,
    body,
    data,
    notificationId: notification ? String(notification._id) : undefined,
    category: 'order',
  });
};

export type ShippingPushMilestone = 'picked' | 'shipping' | 'delivered' | 'failed';

const shippingPushCopy: Record<ShippingPushMilestone, { title: string; body: string }> = {
  picked: {
    title: 'Đơn vị vận chuyển đã lấy hàng',
    body: 'Đơn hàng của bạn đã rời shop.',
  },
  shipping: {
    title: 'Đơn đang được giao',
    body: 'Đơn hàng đang trên đường đến bạn.',
  },
  delivered: {
    title: 'Đã giao hàng',
    body: 'Bạn kiểm tra và xác nhận đã nhận hàng trong 7 ngày nhé.',
  },
  failed: {
    title: 'Chưa giao được hàng',
    body: 'Shop sẽ theo dõi và hỗ trợ giao lại.',
  },
};

export const sendShippingUpdatePush = async (input: {
  userId: string;
  orderId: string;
  orderCode: string;
  milestone: ShippingPushMilestone;
}) => {
  if (!Types.ObjectId.isValid(input.userId)) return { sent: 0 };
  const copy = shippingPushCopy[input.milestone];
  const title = `${copy.title} · ${input.orderCode}`;
  const data = {
    type: 'shipping_update',
    orderId: input.orderId,
    milestone: input.milestone,
  };

  const notification = await createCustomerNotificationBestEffort({
    userId: input.userId,
    category: 'order',
    type: 'shipping_update',
    title,
    body: copy.body,
    action: { type: 'order_detail', label: 'Xem hành trình', entityId: input.orderId },
    data: { ...data, orderCode: input.orderCode },
    dedupeKey: `order:${input.orderId}:shipping:${input.milestone}`,
  });

  return sendCustomerPush({
    userId: input.userId,
    title,
    body: copy.body,
    data,
    notificationId: notification ? String(notification._id) : undefined,
    disabled: process.env.SHIPPING_PUSH_NOTIFICATIONS === 'false',
    category: 'order',
  });
};

export const pushNotificationService = {
  registerPushToken,
  sendCustomerPush,
  sendShippingUpdatePush,
  sendSupportReplyPush,
  sendPaymentDeadlineWarningPush,
  unregisterPushToken,
};
