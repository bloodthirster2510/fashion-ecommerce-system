import { auditLogService } from '../audit-logs/audit-log.service';
import { orderService } from './order.service';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let isRunning = false;

const getIntervalMs = () => {
  const configured = Number(process.env.ORDER_AUTO_COMPLETE_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_INTERVAL_MS;
};

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const result = await orderService.autoCompleteDeliveredOrders();
    if (result.scannedCount > 0) {
      await auditLogService.recordAuditLogBestEffort({
        actorRole: 'system',
        action: 'order.auto_complete_delivered',
        targetType: 'Order',
        targetId: 'order-auto-complete-scheduler',
        reason: 'Auto-complete delivered orders after customer confirmation window',
        after: {
          cutoff: result.cutoff,
          scannedCount: result.scannedCount,
          completedCount: result.completedCount,
          failedCount: result.failedCount,
        },
        metadata: {
          completedOrderIds: result.completedOrderIds,
          failures: result.failures,
        },
      });
    }
  } catch (error) {
    console.error('Order auto-complete scheduler failed:', error instanceof Error ? error.message : String(error));
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (process.env.ORDER_AUTO_COMPLETE_SCHEDULER === 'false' || timer) return;
  const intervalMs = getIntervalMs();
  timer = setInterval(() => { void runOnce(); }, intervalMs);
  timer.unref?.();
  void runOnce();
  console.log(`Order auto-complete scheduler started with interval ${intervalMs}ms`);
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const orderAutoCompleteScheduler = { start, stop, runOnce };
