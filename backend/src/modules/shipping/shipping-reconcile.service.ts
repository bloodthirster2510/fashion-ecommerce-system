import crypto from 'crypto';
import { DistributedLock, Order } from '../../database/models';
import { orderService } from '../orders/order.service';

const LOCK_NAME = 'shipping-reconcile';
const DEFAULT_STALE_MINUTES = 30;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_LOCK_TTL_MS = 15 * 60 * 1000;

export type ShippingReconcileResult = {
  processedCount: number;
  updatedCount: number;
  failedCount: number;
  orderIds: string[];
  updatedOrderIds: string[];
  failures: Array<{ orderId: string; message: string }>;
  lockSkipped?: boolean;
};

const readNumberEnv = (name: string, fallback: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum
    ? Math.min(Math.floor(value), maximum)
    : fallback;
};

const createEmptyResult = (lockSkipped = false): ShippingReconcileResult => ({
  processedCount: 0,
  updatedCount: 0,
  failedCount: 0,
  orderIds: [],
  updatedOrderIds: [],
  failures: [],
  ...(lockSkipped ? { lockSkipped: true } : {}),
});

const isDuplicateKeyError = (error: unknown) => Boolean(
  error && typeof error === 'object' && 'code' in error
  && (error as { code?: unknown }).code === 11000,
);

const acquireLock = async (now: Date) => {
  const ownerId = `${process.pid}:${crypto.randomUUID()}`;
  const lockTtlMs = readNumberEnv('SHIPPING_RECONCILE_LOCK_TTL_MS', DEFAULT_LOCK_TTL_MS, 60_000);
  try {
    const result = await DistributedLock.updateOne(
      { name: LOCK_NAME, $or: [{ expiresAt: { $lte: now } }, { ownerId }] },
      {
        $set: { ownerId, expiresAt: new Date(now.getTime() + lockTtlMs) },
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

const releaseLock = (ownerId: string) => DistributedLock.deleteOne({ name: LOCK_NAME, ownerId });

const reconcileStaleShipments = async (now = new Date()): Promise<ShippingReconcileResult> => {
  const staleMinutes = readNumberEnv('SHIPPING_RECONCILE_STALE_MINUTES', DEFAULT_STALE_MINUTES, 1);
  const batchSize = readNumberEnv('SHIPPING_RECONCILE_BATCH_SIZE', DEFAULT_BATCH_SIZE, 1, 100);
  const staleBefore = new Date(now.getTime() - staleMinutes * 60_000);
  const orders = await Order.find({
    status: { $in: ['packed', 'shipping'] },
    'shipping.provider': 'GHN',
    'shipping.trackingCode': { $type: 'string', $ne: '' },
    'shipping.status': { $nin: ['delivered', 'failed', 'cancelled'] },
    updatedAt: { $lt: staleBefore },
  })
    .select('_id')
    .sort({ updatedAt: 1 })
    .limit(batchSize)
    .lean();

  const result = createEmptyResult();
  for (const order of orders) {
    const orderId = order._id.toString();
    result.orderIds.push(orderId);
    try {
      const syncResult = await orderService.syncGhnShipment(orderId);
      result.processedCount += 1;
      const changed = syncResult.before.status !== syncResult.order.status
        || (syncResult.before.shipping?.status ?? null) !== (syncResult.order.shipping?.status ?? null);
      if (changed) result.updatedOrderIds.push(orderId);
    } catch (error) {
      result.processedCount += 1;
      result.failures.push({
        orderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  result.updatedCount = result.updatedOrderIds.length;
  result.failedCount = result.failures.length;
  return result;
};

const reconcileStaleShipmentsWithLock = async (now = new Date()): Promise<ShippingReconcileResult> => {
  const ownerId = await acquireLock(now);
  if (!ownerId) return createEmptyResult(true);
  try {
    return await reconcileStaleShipments(now);
  } finally {
    await releaseLock(ownerId);
  }
};

export const shippingReconcileService = {
  reconcileStaleShipments,
  reconcileStaleShipmentsWithLock,
};
