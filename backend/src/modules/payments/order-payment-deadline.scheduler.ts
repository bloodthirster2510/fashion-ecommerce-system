import { getOrderPaymentDeadlineSchedulerIntervalMs } from './order-payment-deadline.config';
import { orderPaymentDeadlineService } from './order-payment-deadline.service';

let timer: NodeJS.Timeout | null = null;
let isRunning = false;

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    await orderPaymentDeadlineService.sweepWithLock();
  } catch (error) {
    console.error('Order payment deadline scheduler failed:', error instanceof Error ? error.message : error);
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (process.env.ORDER_PAYMENT_DEADLINE_SCHEDULER === 'false' || timer) return;
  const intervalMs = getOrderPaymentDeadlineSchedulerIntervalMs();
  timer = setInterval(() => { void runOnce(); }, intervalMs);
  timer.unref?.();
  void runOnce();
  console.log(`Order payment deadline scheduler started with interval ${intervalMs}ms`);
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const orderPaymentDeadlineScheduler = { start, stop, runOnce };
