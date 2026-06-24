import crypto from 'crypto';
import { DistributedLock, Order, Transaction } from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';
import { pushNotificationService } from '../notifications/push-notification.service';
import { orderService } from '../orders/order.service';
import {
  getOrderPaymentDeadlineSchedulerIntervalMs,
  getOrderPaymentDeadlineWarningMs,
  ONLINE_PAYMENT_METHODS,
} from './order-payment-deadline.config';

const LOCK_NAME = 'order-payment-deadline';
const LOCK_TTL_FLOOR_MS = 60_000;

export type OrderPaymentDeadlineSweepResult = {
  cancelledOrderIds: string[];
  warnedOrderIds: string[];
  lockSkipped?: boolean;
};

const emptyResult = (lockSkipped = false): OrderPaymentDeadlineSweepResult => ({
  cancelledOrderIds: [],
  warnedOrderIds: [],
  ...(lockSkipped ? { lockSkipped: true } : {}),
});

const isDuplicateKeyError = (error: unknown) => Boolean(
  error && typeof error === 'object' && 'code' in error &&
  (error as { code?: unknown }).code === 11000,
);

const acquireLock = async (now: Date) => {
  const ownerId = `${process.pid}:${crypto.randomUUID()}`;
  const ttl = Math.max(LOCK_TTL_FLOOR_MS, getOrderPaymentDeadlineSchedulerIntervalMs());
  try {
    const result = await DistributedLock.updateOne(
      { name: LOCK_NAME, $or: [{ expiresAt: { $lte: now } }, { ownerId }] },
      {
        $set: { ownerId, expiresAt: new Date(now.getTime() + ttl) },
        $setOnInsert: { name: LOCK_NAME },
      },
      { upsert: true },
    );
    return result.upsertedCount > 0 || result.modifiedCount > 0 ? ownerId : null;
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
};

const processWarnings = async (now: Date) => {
  const warningCutoff = new Date(now.getTime() + getOrderPaymentDeadlineWarningMs());
  const orders = await Order.find({
    status: 'confirmed',
    paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
    paymentStatus: { $in: ['pending', 'failed'] },
    paymentDeadlineAt: { $gt: now, $lte: warningCutoff },
    paymentDeadlineWarningSentAt: null,
  })
    .select('_id user_id orderCode paymentDeadlineAt')
    .lean();
  const warnedOrderIds: string[] = [];

  for (const order of orders) {
    if (!order.paymentDeadlineAt) continue;
    try {
      await pushNotificationService.sendPaymentDeadlineWarningPush({
        userId: order.user_id.toString(),
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        paymentDeadlineAt: order.paymentDeadlineAt,
      });
      const updated = await Order.updateOne(
        { _id: order._id, paymentDeadlineWarningSentAt: null },
        { $set: { paymentDeadlineWarningSentAt: now } },
      );
      if (updated.modifiedCount > 0) warnedOrderIds.push(order._id.toString());
    } catch (error) {
      console.error(`Payment deadline warning failed for ${order.orderCode}:`, error);
    }
  }

  return warnedOrderIds;
};

const processExpiredOrders = async (now: Date) => {
  const candidates = await Order.find({
    status: 'confirmed',
    paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
    paymentStatus: { $in: ['pending', 'failed'] },
    paymentDeadlineAt: { $lte: now },
  }).select('_id').lean();
  const cancelledOrderIds: string[] = [];

  for (const candidate of candidates) {
    const order = await orderService.cancelOrderForPaymentDeadline(candidate._id.toString(), now);
    if (!order) continue;

    await Transaction.updateMany(
      { order_id: order._id, status: 'pending' },
      {
        $set: {
          status: 'expired',
          resolvedAt: now,
          failureReason: 'order_payment_deadline_exceeded',
        },
      },
    );
    cancelledOrderIds.push(order._id.toString());
    await auditLogService.recordAuditLogBestEffort({
      actorRole: 'system',
      action: 'payment.expire',
      targetType: 'Order',
      targetId: order._id.toString(),
      reason: 'Order payment deadline exceeded (3 days)',
      after: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentDeadlineAt: order.paymentDeadlineAt ?? null,
        cancellation: order.cancellation ?? null,
      },
      metadata: { orderCode: order.orderCode },
    });
  }

  return cancelledOrderIds;
};

export const orderPaymentDeadlineService = {
  sweep: async (now = new Date()): Promise<OrderPaymentDeadlineSweepResult> => ({
    warnedOrderIds: await processWarnings(now),
    cancelledOrderIds: await processExpiredOrders(now),
  }),

  sweepWithLock: async (now = new Date()): Promise<OrderPaymentDeadlineSweepResult> => {
    const ownerId = await acquireLock(now);
    if (!ownerId) return emptyResult(true);

    try {
      return await orderPaymentDeadlineService.sweep(now);
    } finally {
      await DistributedLock.deleteOne({ name: LOCK_NAME, ownerId });
    }
  },
};
