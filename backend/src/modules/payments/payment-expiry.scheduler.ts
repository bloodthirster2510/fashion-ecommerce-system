import { auditLogService } from '../audit-logs/audit-log.service';
import { paymentExpiryService } from './payment-expiry.service';

const DEFAULT_EXPIRY_INTERVAL_MS = 60_000;

let expiryTimer: NodeJS.Timeout | null = null;
let isRunning = false;

const getIntervalMs = () => {
  const configuredInterval = Number(process.env.PAYMENT_EXPIRY_INTERVAL_MS);
  if (Number.isFinite(configuredInterval) && configuredInterval >= 10_000) {
    return configuredInterval;
  }

  return DEFAULT_EXPIRY_INTERVAL_MS;
};

const expireOnce = async () => {
  if (isRunning) return;

  isRunning = true;
  try {
    const result = await paymentExpiryService.expireStaleTransactions();

    if (result.expiredCount > 0) {
      await auditLogService.recordAuditLogBestEffort({
        actorRole: 'system',
        action: 'payment.expire',
        targetType: 'Transaction',
        targetId: 'payment-expiry-scheduler',
        reason: 'Automatic payment attempt expiry',
        after: {
          expiredCount: result.expiredCount,
          orderIds: result.orderIds,
        },
        metadata: {
          transactions: result.transactions,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Payment expiry scheduler failed:', message);
  } finally {
    isRunning = false;
  }
};

const startPaymentExpiryScheduler = () => {
  if (process.env.PAYMENT_EXPIRY_SCHEDULER === 'false') {
    return;
  }

  if (expiryTimer) {
    return;
  }

  const intervalMs = getIntervalMs();
  expiryTimer = setInterval(() => {
    void expireOnce();
  }, intervalMs);
  expiryTimer.unref?.();

  void expireOnce();
  console.log(`Payment expiry scheduler started with interval ${intervalMs}ms`);
};

const stopPaymentExpiryScheduler = () => {
  if (!expiryTimer) {
    return;
  }

  clearInterval(expiryTimer);
  expiryTimer = null;
};

export const paymentExpiryScheduler = {
  startPaymentExpiryScheduler,
  stopPaymentExpiryScheduler,
};
