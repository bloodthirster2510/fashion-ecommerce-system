import { auditLogService } from '../audit-logs/audit-log.service';
import { shippingReconcileService } from './shipping-reconcile.service';

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let isRunning = false;

const getIntervalMs = () => {
  const configured = Number(process.env.SHIPPING_RECONCILE_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_INTERVAL_MS;
};

const reconcileOnce = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const result = await shippingReconcileService.reconcileStaleShipmentsWithLock();
    if (!result.lockSkipped && result.processedCount > 0) {
      await auditLogService.recordAuditLogBestEffort({
        actorRole: 'system',
        action: 'order.shipping_reconcile',
        targetType: 'Order',
        targetId: 'shipping-reconcile-scheduler',
        reason: 'Automatic GHN shipping reconciliation',
        after: {
          processedCount: result.processedCount,
          updatedCount: result.updatedCount,
          failedCount: result.failedCount,
        },
        metadata: {
          orderIds: result.orderIds,
          updatedOrderIds: result.updatedOrderIds,
          failures: result.failures,
        },
      });
    }
  } catch (error) {
    console.error('Shipping reconcile scheduler failed:', error instanceof Error ? error.message : String(error));
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (process.env.SHIPPING_RECONCILE_SCHEDULER === 'false' || timer) return;
  const intervalMs = getIntervalMs();
  timer = setInterval(() => { void reconcileOnce(); }, intervalMs);
  timer.unref?.();
  void reconcileOnce();
  console.log(`Shipping reconcile scheduler started with interval ${intervalMs}ms`);
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const shippingReconcileScheduler = { start, stop, reconcileOnce };
