import { couponLifecycleService } from './coupon-lifecycle.service';

const DEFAULT_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

const syncOnce = async () => {
  if (running) return;
  running = true;
  try {
    await couponLifecycleService.syncLifecycleStatuses();
  } catch (error) {
    console.error('Coupon lifecycle scheduler failed:', error instanceof Error ? error.message : String(error));
  } finally {
    running = false;
  }
};

const start = () => {
  if (process.env.COUPON_LIFECYCLE_SCHEDULER === 'false' || timer) return;
  const configured = Number(process.env.COUPON_LIFECYCLE_INTERVAL_MS);
  const intervalMs = Number.isFinite(configured) && configured >= 10_000 ? configured : DEFAULT_INTERVAL_MS;
  timer = setInterval(() => void syncOnce(), intervalMs);
  timer.unref?.();
  void syncOnce();
  console.log(`Coupon lifecycle scheduler started with interval ${intervalMs}ms`);
};

const stop = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export const couponLifecycleScheduler = { start, stop, syncOnce };
