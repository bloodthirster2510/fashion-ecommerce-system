import { Types } from 'mongoose';
import { PushToken } from '../../database/models';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const expoTokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export const registerPushToken = async (
  userId: string,
  input: { token?: string; platform?: string },
) => {
  if (!Types.ObjectId.isValid(userId)) throw Object.assign(new Error('Invalid user'), { statusCode: 400 });
  const token = input.token?.trim() ?? '';
  if (!expoTokenPattern.test(token)) throw Object.assign(new Error('Invalid Expo push token'), { statusCode: 400 });
  if (!input.platform || !['ios', 'android'].includes(input.platform)) {
    throw Object.assign(new Error('Invalid push platform'), { statusCode: 400 });
  }

  return PushToken.findOneAndUpdate(
    { token },
    { userId: new Types.ObjectId(userId), platform: input.platform, isActive: true, lastUsedAt: new Date() },
    { upsert: true, new: true, runValidators: true },
  ).lean();
};

export const unregisterPushToken = async (userId: string, token: string) => {
  if (!Types.ObjectId.isValid(userId)) return { disabled: false };
  const result = await PushToken.updateOne(
    { userId: new Types.ObjectId(userId), token: token.trim() },
    { isActive: false },
  );
  return { disabled: result.modifiedCount > 0 };
};

export const sendSupportReplyPush = async (input: {
  userId: string;
  ticketId: string;
  ticketCode: string;
  subject: string;
}) => {
  if (process.env.SUPPORT_PUSH_NOTIFICATIONS === 'false' || !Types.ObjectId.isValid(input.userId)) {
    return { sent: 0 };
  }
  const tokens = await PushToken.find({ userId: new Types.ObjectId(input.userId), isActive: true })
    .select('token')
    .lean<Array<{ token: string }>>();
  if (!tokens.length) return { sent: 0 };

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: `Phản hồi ${input.ticketCode}`,
      body: input.subject,
      data: { type: 'support_reply', ticketId: input.ticketId },
    }))),
  });
  if (!response.ok) throw new Error(`Expo push request failed with status ${response.status}`);
  const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
  const invalidTokens = tokens.filter((_, index) => payload.data?.[index]?.details?.error === 'DeviceNotRegistered');
  if (invalidTokens.length) {
    await PushToken.updateMany(
      { token: { $in: invalidTokens.map((item) => item.token) } },
      { isActive: false },
    );
  }
  const failed = payload.data?.filter((item) => item.status === 'error').length ?? 0;
  return { sent: tokens.length - failed, failed };
};

export const sendPaymentDeadlineWarningPush = async (input: {
  userId: string;
  orderId: string;
  orderCode: string;
  paymentDeadlineAt: Date;
}) => {
  if (!Types.ObjectId.isValid(input.userId)) return { sent: 0 };

  const tokens = await PushToken.find({ userId: new Types.ObjectId(input.userId), isActive: true })
    .select('token')
    .lean<Array<{ token: string }>>();
  if (!tokens.length) return { sent: 0 };

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: `Đơn ${input.orderCode} sắp tự hủy`,
      body: 'Thanh toán ngay trong 24 giờ tới để giữ hàng.',
      data: {
        type: 'payment_deadline',
        orderId: input.orderId,
        paymentDeadlineAt: input.paymentDeadlineAt.toISOString(),
      },
    }))),
  });
  if (!response.ok) throw new Error(`Expo push request failed with status ${response.status}`);

  const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
  const invalidTokens = tokens.filter((_, index) => payload.data?.[index]?.details?.error === 'DeviceNotRegistered');
  if (invalidTokens.length) {
    await PushToken.updateMany(
      { token: { $in: invalidTokens.map((item) => item.token) } },
      { isActive: false },
    );
  }
  const failed = payload.data?.filter((item) => item.status === 'error').length ?? 0;
  return { sent: tokens.length - failed, failed };
};

export type ShippingPushMilestone = 'picked' | 'shipping' | 'delivered' | 'failed';

const shippingPushCopy: Record<ShippingPushMilestone, { title: string; body: string }> = {
  picked: { title: 'Đơn đã được lấy hàng', body: 'Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển.' },
  shipping: { title: 'Đơn đang trên đường', body: 'Tài xế đang giao đơn hàng đến bạn.' },
  delivered: { title: 'Đơn đã giao đến bạn', body: 'Kiểm tra đơn và xác nhận đã nhận hàng trong 7 ngày nhé.' },
  failed: { title: 'Giao hàng chưa thành công', body: 'Shop sẽ theo dõi và liên hệ với bạn để hỗ trợ giao lại.' },
};

export const sendShippingUpdatePush = async (input: {
  userId: string;
  orderId: string;
  orderCode: string;
  milestone: ShippingPushMilestone;
}) => {
  if (process.env.SHIPPING_PUSH_NOTIFICATIONS === 'false' || !Types.ObjectId.isValid(input.userId)) {
    return { sent: 0 };
  }

  const tokens = await PushToken.find({ userId: new Types.ObjectId(input.userId), isActive: true })
    .select('token')
    .lean<Array<{ token: string }>>();
  if (!tokens.length) return { sent: 0 };

  const copy = shippingPushCopy[input.milestone];
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: `${copy.title} · ${input.orderCode}`,
      body: copy.body,
      data: {
        type: 'shipping_update',
        orderId: input.orderId,
        milestone: input.milestone,
      },
    }))),
  });
  if (!response.ok) throw new Error(`Expo push request failed with status ${response.status}`);

  const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
  const invalidTokens = tokens.filter((_, index) => payload.data?.[index]?.details?.error === 'DeviceNotRegistered');
  if (invalidTokens.length) {
    await PushToken.updateMany(
      { token: { $in: invalidTokens.map((item) => item.token) } },
      { isActive: false },
    );
  }
  const failed = payload.data?.filter((item) => item.status === 'error').length ?? 0;
  return { sent: tokens.length - failed, failed };
};

export const pushNotificationService = {
  registerPushToken,
  sendShippingUpdatePush,
  sendSupportReplyPush,
  sendPaymentDeadlineWarningPush,
  unregisterPushToken,
};
