import { colors } from '../../theme';
import type { CustomerOrder, OrderPaymentMethod, OrderStatus, OrderStatusSummary } from './orderApi';

export type OrderTabKey =
  | 'active'
  | 'shipping'
  | 'completed'
  | 'issues'
  | 'all';

export type OrderTab = {
  key: OrderTabKey;
  label: string;
  helper: string;
  statuses: OrderStatus[];
};

export const orderTabs: OrderTab[] = [
  {
    key: 'active',
    label: 'Đang xử lý',
    helper: 'Shop xác nhận & chuẩn bị',
    statuses: ['confirmed', 'packed'],
  },
  {
    key: 'shipping',
    label: 'Đang giao',
    helper: 'Theo dõi vận chuyển & xác nhận',
    statuses: ['shipping', 'delivered'],
  },
  {
    key: 'completed',
    label: 'Hoàn tất',
    helper: 'Đã giao thành công',
    statuses: ['completed'],
  },
  {
    key: 'issues',
    label: 'Cần hỗ trợ',
    helper: 'Trả hàng/chờ đối soát',
    statuses: ['return_requested', 'return_approved'],
  },
  {
    key: 'all',
    label: 'Lịch sử',
    helper: 'Đã giao, đã hủy hoặc đã trả',
    statuses: ['completed', 'cancelled', 'returned'],
  },
];

export const getOrderTab = (key: OrderTabKey) =>
  orderTabs.find((tab) => tab.key === key) ?? orderTabs[0];

export const getOrderMatchesTab = (order: CustomerOrder, key: OrderTabKey) =>
  getOrderTab(key).statuses.includes(order.status);

export const getOrderTabCount = (summary: OrderStatusSummary | null, key: OrderTabKey) => {
  if (!summary) return undefined;

  return getOrderTab(key).statuses.reduce((total, status) => total + (summary[status] ?? 0), 0);
};

export const getPrimaryStatusForTab = (key: OrderTabKey) => {
  const statuses = getOrderTab(key).statuses;
  return statuses.length === 1 ? statuses[0] : undefined;
};

export type OrderDisplayTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export type OrderDisplayState = {
  label: string;
  description: string;
  deliveryLine: string;
  icon: string;
  tone: OrderDisplayTone;
  color: string;
  backgroundColor: string;
  requiresUserAction: boolean;
};

export const supportedPaymentMethods: OrderPaymentMethod[] = ['COD', 'VNPAY'];
export const onlinePaymentMethods: OrderPaymentMethod[] = ['VNPAY'];

const onlinePaymentMethodSet = new Set<OrderPaymentMethod>(onlinePaymentMethods);
const closedOrderStatuses = new Set<OrderStatus>(['completed', 'cancelled', 'returned']);

export const shippingStatusLabels: Record<string, string> = {
  created: 'Đã tạo vận đơn',
  quoted: 'Đã báo phí',
  fallback: 'Phí cố định',
  ready: 'Sẵn sàng giao',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  shipping: 'Đang giao',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy vận chuyển',
  returned: 'Đã trả hàng',
  failed: 'Giao hàng thất bại',
};

export const getShippingStatusLabel = (status?: string | null) => {
  if (!status) return 'Đang chờ vận chuyển';

  return shippingStatusLabels[status] ?? status;
};

export const hasFailedDelivery = (order: Pick<CustomerOrder, 'status' | 'shipping'>) =>
  order.status === 'shipping' && order.shipping?.status === 'failed';

export const isOnlinePaymentOrder = (order: CustomerOrder) =>
  onlinePaymentMethodSet.has(order.paymentMethod);

export const orderNeedsPaymentAction = (order: CustomerOrder) =>
  order.paymentMethod === 'VNPAY' &&
  (order.paymentStatus === 'pending' || order.paymentStatus === 'failed') &&
  !closedOrderStatuses.has(order.status);

export const getOrderDisplayState = (order: CustomerOrder): OrderDisplayState => {
  if (orderNeedsPaymentAction(order)) {
    const isFailed = order.paymentStatus === 'failed';
    const color = isFailed ? colors.danger : colors.goldText;
    const backgroundColor = isFailed ? colors.dangerSoft : colors.goldSoft;

    return {
      label: isFailed ? 'Thanh toán lỗi' : 'Chờ thanh toán',
      description: isFailed ? 'Mở chi tiết để thử lại.' : 'Thanh toán để shop xử lý đơn.',
      deliveryLine: isFailed ? 'Thanh toán lỗi, cần thử lại.' : 'Chờ bạn hoàn tất thanh toán.',
      icon: 'credit-card-clock-outline',
      tone: isFailed ? 'danger' : 'warning',
      color,
      backgroundColor,
      requiresUserAction: true,
    };
  }

  if (order.status === 'cancelled') {
    const isPaid = order.paymentStatus === 'paid';

    return {
      label: 'Đã hủy',
      description: isPaid ? 'Đang chờ shop xử lý hoàn tiền.' : 'Đơn đã được hủy.',
      deliveryLine: `Đã hủy: ${formatDate(order.updatedAt)}`,
      icon: isPaid ? 'cash-refund' : 'close-circle-outline',
      tone: isPaid ? 'warning' : 'danger',
      color: isPaid ? colors.goldText : colors.danger,
      backgroundColor: isPaid ? colors.goldSoft : colors.dangerSoft,
      requiresUserAction: false,
    };
  }

  if (order.status === 'return_requested') {
    return {
      label: 'Đang duyệt trả hàng',
      description: 'Shop đang xem yêu cầu của bạn.',
      deliveryLine: 'Yêu cầu trả hàng đang chờ shop phản hồi.',
      icon: 'archive-clock-outline',
      tone: 'warning',
      color: colors.coral,
      backgroundColor: '#FFF0EA',
      requiresUserAction: false,
    };
  }

  if (order.status === 'return_approved') {
    return {
      label: 'Đã duyệt trả hàng',
      description: 'Gửi sản phẩm theo hướng dẫn của shop.',
      deliveryLine: 'Shop đang chờ nhận hàng trả.',
      icon: 'archive-arrow-up-outline',
      tone: 'info',
      color: colors.action,
      backgroundColor: '#EAF3FF',
      requiresUserAction: true,
    };
  }

  if (order.status === 'returned') {
    return {
      label: 'Đã trả hàng',
      description: 'Yêu cầu trả hàng đã hoàn tất.',
      deliveryLine: `Đã trả hàng: ${formatDate(order.updatedAt)}`,
      icon: 'archive-check-outline',
      tone: 'neutral',
      color: colors.textMuted,
      backgroundColor: '#EEF1F4',
      requiresUserAction: false,
    };
  }

  if (order.status === 'delivered') {
    return {
      label: 'Đã giao tới bạn',
      description: 'Đơn vị vận chuyển đã báo giao thành công. Hãy xác nhận khi bạn đã nhận được hàng; sau 7 ngày hệ thống sẽ tự hoàn tất đơn.',
      deliveryLine: `Đã giao: ${formatDate(order.deliveredAt ?? order.updatedAt)}`,
      icon: 'package-check',
      tone: 'success',
      color: colors.success,
      backgroundColor: colors.successSoft,
      requiresUserAction: true,
    };
  }

  if (order.status === 'completed') {
    return {
      label: 'Hoàn tất',
      description: 'Bạn đã xác nhận nhận hàng.',
      deliveryLine: `Hoàn tất: ${formatDate(order.receivedAt ?? order.updatedAt)}`,
      icon: 'package-check',
      tone: 'success',
      color: colors.success,
      backgroundColor: colors.successSoft,
      requiresUserAction: false,
    };
  }

  if (hasFailedDelivery(order)) {
    return {
      label: 'Giao hàng thất bại',
      description: 'Đơn vị vận chuyển báo giao không thành công. Shop sẽ liên hệ để giao lại hoặc xử lý tiếp.',
      deliveryLine: `Giao thất bại: ${formatDate(order.updatedAt)}`,
      icon: 'truck-alert-outline',
      tone: 'danger',
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      requiresUserAction: false,
    };
  }

  if (order.status === 'shipping') {
    return {
      label: getShippingStatusLabel(order.shipping?.status),
      description: 'Đơn đang trên đường tới bạn. Khi đơn vị vận chuyển báo đã giao, bạn sẽ có thể xác nhận nhận hàng.',
      deliveryLine: `Dự kiến giao: ${formatDate(getEstimatedDeliveryDate(order))}`,
      icon: 'truck-check-outline',
      tone: 'info',
      color: colors.action,
      backgroundColor: '#EAF3FF',
      requiresUserAction: false,
    };
  }

  if (order.status === 'packed') {
    return {
      label: 'Đang chuẩn bị hàng',
      description: 'Shop đang đóng gói hoặc bàn giao vận chuyển.',
      deliveryLine: `Dự kiến giao: ${formatDate(getEstimatedDeliveryDate(order))}`,
      icon: 'package-variant-closed',
      tone: 'info',
      color: colors.brandDark,
      backgroundColor: colors.brandSoft,
      requiresUserAction: false,
    };
  }

  return {
    label: 'Chờ shop xử lý',
    description: isOnlinePaymentOrder(order) && order.paymentStatus === 'paid'
      ? 'Đã thanh toán, shop đang kiểm tra đơn.'
      : 'Shop đang kiểm tra và xác nhận đơn.',
    deliveryLine: `Dự kiến giao: ${formatDate(getEstimatedDeliveryDate(order))}`,
    icon: isOnlinePaymentOrder(order) && order.paymentStatus === 'paid'
      ? 'check-decagram-outline'
      : 'clipboard-text-clock-outline',
    tone: 'warning',
    color: colors.goldText,
    backgroundColor: colors.goldSoft,
    requiresUserAction: false,
  };
};

export const orderNeedsUserAction = (order: CustomerOrder) =>
  getOrderDisplayState(order).requiresUserAction;

export const statusMeta: Record<OrderStatus, {
  label: string;
  description: string;
  color: string;
  backgroundColor: string;
}> = {
  confirmed: {
    label: 'Chờ shop xử lý',
    description: 'Shop đang kiểm tra và xác nhận đơn.',
    color: colors.goldText,
    backgroundColor: colors.goldSoft,
  },
  packed: {
    label: 'Đang chuẩn bị hàng',
    description: 'Shop đang đóng gói hoặc bàn giao vận chuyển.',
    color: colors.brandDark,
    backgroundColor: colors.brandSoft,
  },
  shipping: {
    label: 'Đang giao',
    description: 'Đơn đã rời kho và đang trên đường tới bạn.',
    color: colors.action,
    backgroundColor: '#EAF3FF',
  },
  delivered: {
    label: 'Đã giao tới bạn',
    description: 'Đơn vị vận chuyển đã báo giao thành công, chờ bạn xác nhận nhận hàng.',
    color: colors.success,
    backgroundColor: colors.successSoft,
  },
  completed: {
    label: 'Hoàn tất',
    description: 'Bạn đã xác nhận nhận hàng.',
    color: colors.success,
    backgroundColor: colors.successSoft,
  },
  cancelled: {
    label: 'Đã hủy',
    description: 'Đơn đã được hủy. Nếu đã thanh toán, shop sẽ xử lý hoàn tiền theo chính sách.',
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  return_requested: {
    label: 'Đang duyệt trả hàng',
    description: 'Shop đang xem yêu cầu của bạn.',
    color: colors.coral,
    backgroundColor: '#FFF0EA',
  },
  return_approved: {
    label: 'Đã duyệt trả hàng',
    description: 'Shop đang chờ nhận sản phẩm trả.',
    color: colors.action,
    backgroundColor: '#EAF3FF',
  },
  returned: {
    label: 'Đã trả hàng',
    description: 'Luồng trả hàng đã hoàn tất.',
    color: colors.textMuted,
    backgroundColor: '#EEF1F4',
  },
};

export const paymentMethodLabels: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'VNPAY',
  MOMO: 'MoMo',
  CARD: 'Thẻ thanh toán',
  BANK: 'Chuyển khoản',
};

export const paymentStatusLabels: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
};

export const formatCurrency = (value: number) =>
  `${Math.round(value || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

export const formatDate = (value?: string | Date | null) => {
  if (!value) return 'Đang cập nhật';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatShortDate = (value?: string | Date | null) => {
  if (!value) return 'Đang cập nhật';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật';

  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
};

export const addDays = (value: string | Date, days: number) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const getEstimatedDeliveryDate = (order: CustomerOrder) =>
  order.shipping?.estimatedDeliveryDate ?? addDays(order.createdAt, 4).toISOString();

export const getDeliveryLine = (order: CustomerOrder) => {
  return getOrderDisplayState(order).deliveryLine;
};

export type OrderAttention = {
  tone: OrderDisplayTone;
  icon: string;
  label: string;
  description: string;
};

export const getOrderAttention = (order: CustomerOrder): OrderAttention | null => {
  const displayState = getOrderDisplayState(order);
  return displayState.requiresUserAction ? displayState : null;
};

export const canCancelOrder = (status: OrderStatus) =>
  status === 'confirmed' || status === 'packed';

export const canRequestReturn = (status: OrderStatus) =>
  status === 'delivered' || status === 'completed';

export const canConfirmReceived = (order: Pick<CustomerOrder, 'status' | 'shipping'>) =>
  order.status === 'delivered';

export const getOrderItemCount = (order: CustomerOrder) =>
  order.order_list.reduce((total, item) => total + item.quantity, 0);

export const formatAddress = (order: CustomerOrder) => {
  const address = order.shippingAddress;
  return [
    address.streetName,
    address.ward,
    address.district,
    address.province,
  ].filter(Boolean).join(', ');
};

export const getPrimaryItem = (order: CustomerOrder) => order.order_list[0];

export const getExtraItemText = (order: CustomerOrder) => {
  const extraItems = Math.max(order.order_list.length - 1, 0);
  if (!extraItems) return null;

  return `+${extraItems} sản phẩm khác`;
};
