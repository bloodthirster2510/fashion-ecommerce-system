export const ORDER_STATUSES = [
  'confirmed',
  'packed',
  'shipping',
  'delivered',
  'cancelled',
  'return_requested',
  'returned',
] as const;

export const PAYMENT_METHODS = ['COD', 'VNPAY', 'MOMO', 'CARD', 'BANK'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export const TERMINAL_PAYMENT_STATUSES = ['paid', 'refunded'] as const;

export const ONLINE_PAYMENT_METHODS = ['VNPAY', 'MOMO', 'CARD', 'BANK'] as const;
export const SUPPORTED_PAYMENT_METHODS = ['COD', 'VNPAY'] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
export type OrderPaymentMethod = typeof PAYMENT_METHODS[number];
export type OrderPaymentStatus = typeof PAYMENT_STATUSES[number];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  confirmed: ['packed', 'cancelled'],
  packed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'return_requested'],
  delivered: ['return_requested'],
  return_requested: ['returned'],
  returned: [],
  cancelled: [],
};

export const SHIPPING_WEBHOOK_STATUSES = [
  'ready',
  'picking',
  'picked',
  'shipping',
  'delivered',
  'failed',
  'cancelled',
] as const;

export const SHIPPING_MILESTONE_STATUSES = [
  'ready',
  'picking',
  'picked',
  'shipping',
  'delivered',
  'failed',
  'cancelled',
] as const;

export type OrderShippingWebhookStatus = typeof SHIPPING_WEBHOOK_STATUSES[number];
export type OrderShippingMilestoneStatus = typeof SHIPPING_MILESTONE_STATUSES[number];
