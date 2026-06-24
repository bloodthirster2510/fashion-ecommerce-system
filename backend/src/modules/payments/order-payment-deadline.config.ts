const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_DEADLINE_DAYS = 3;
const DEFAULT_WARNING_HOURS = 24;
const DEFAULT_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;

const readNonNegativeNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getOrderPaymentDeadlineMs = () =>
  readNonNegativeNumber(process.env.ORDER_PAYMENT_DEADLINE_DAYS, DEFAULT_DEADLINE_DAYS) * DAY_MS;

export const getOrderPaymentDeadlineWarningMs = () =>
  readNonNegativeNumber(process.env.ORDER_PAYMENT_DEADLINE_WARNING_HOURS, DEFAULT_WARNING_HOURS) * HOUR_MS;

export const getOrderPaymentDeadlineSchedulerIntervalMs = () => {
  const configured = Number(process.env.ORDER_PAYMENT_DEADLINE_SCHEDULER_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 60_000
    ? configured
    : DEFAULT_SCHEDULER_INTERVAL_MS;
};

export const getOrderPaymentDeadlineAt = (createdAt = new Date()) =>
  new Date(createdAt.getTime() + getOrderPaymentDeadlineMs());

export const ONLINE_PAYMENT_METHODS = ['VNPAY', 'MOMO', 'CARD', 'BANK'] as const;
