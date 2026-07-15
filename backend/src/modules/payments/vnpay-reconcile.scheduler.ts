import { auditLogService } from '../audit-logs/audit-log.service';
import { vnpayReconcileService } from './vnpay-reconcile.service';

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let isRunning = false;

const getIntervalMs = () => {
  const value = Number(process.env.VNPAY_RECONCILE_INTERVAL_MS);
  return Number.isFinite(value) && value >= 60_000 ? value : DEFAULT_INTERVAL_MS;
};

const reconcileOnce = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const result = await vnpayReconcileService.reconcileStaleTransactionsWithLock();
    if (!result.lockSkipped && result.processedCount > 0) {
      await auditLogService.recordAuditLogBestEffort({
        actorRole: 'system',
        action: 'payment.vnpay_reconcile',
        targetType: 'Transaction',
        targetId: 'vnpay-reconcile-scheduler',
        reason: 'Automatic VNPay QueryDr reconciliation',
        after: {
          processedCount: result.processedCount,
          updatedCount: result.updatedCount,
          failedCount: result.failedCount,
        },
        metadata: {
          transactionIds: result.transactionIds,
          failures: result.failures,
        },
      });
    }
  } catch (error) {
    console.error('VNPay reconcile scheduler failed:', error instanceof Error ? error.message : String(error));
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (process.env.VNPAY_RECONCILE_SCHEDULER !== 'true' || timer) return;
  const intervalMs = getIntervalMs();
  timer = setInterval(() => { void reconcileOnce(); }, intervalMs);
  timer.unref?.();
  void reconcileOnce();
  console.log(`VNPay reconcile scheduler started with interval ${intervalMs}ms`);
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const vnpayReconcileScheduler = { start, stop, reconcileOnce };
