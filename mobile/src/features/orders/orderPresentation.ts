import { colors } from '../../theme';
import type { CustomerOrder, OrderStatus, OrderStatusSummary } from './orderApi';

export type OrderTabKey =
  | 'all'
  | 'waiting'
  | 'processing'
  | 'shipping'
  | 'completed'
  | 'issues';

export type OrderTab = {
  key: OrderTabKey;
  label: string;
  helper: string;
  statuses: OrderStatus[];
};

export const orderTabs: OrderTab[] = [
  {
    key: 'all',
    label: 'Tất cả',
    helper: 'Toàn bộ đơn',
    statuses: ['confirmed', 'packed', 'shipping', 'delivered', 'cancelled', 'return_requested', 'returned'],
  },
  {
    key: 'waiting',
    label: 'Chờ xác nhận',
    helper: 'Shop kiểm tra đơn',
    statuses: ['confirmed'],
  },
  {
    key: 'processing',
    label: 'Đang xử lý',
    helper: 'Đóng gói, chuẩn bị giao',
    statuses: ['packed'],
  },
  {
    key: 'shipping',
    label: 'Đang giao',
    helper: 'Theo dõi vận chuyển',
    statuses: ['shipping'],
  },
  {
    key: 'completed',
    label: 'Hoàn thành',
    helper: 'Đã giao thành công',
    statuses: ['delivered'],
  },
  {
    key: 'issues',
    label: 'Hủy/Trả',
    helper: 'Đơn hủy hoặc đổi trả',
    statuses: ['cancelled', 'return_requested', 'returned'],
  },
];

export const getOrderTab = (key: OrderTabKey) =>
  orderTabs.find((tab) => tab.key === key) ?? orderTabs[0];

export const getOrderMatchesTab = (order: CustomerOrder, key: OrderTabKey) =>
  getOrderTab(key).statuses.includes(order.status);

export const getOrderTabCount = (summary: OrderStatusSummary | null, key: OrderTabKey) => {
  if (!summary) return undefined;
  if (key === 'all') return summary.all;

  return getOrderTab(key).statuses.reduce((total, status) => total + (summary[status] ?? 0), 0);
};

export const getPrimaryStatusForTab = (key: OrderTabKey) => {
  const statuses = getOrderTab(key).statuses;
  return statuses.length === 1 ? statuses[0] : undefined;
};

export const statusMeta: Record<OrderStatus, {
  label: string;
  description: string;
  color: string;
  backgroundColor: string;
}> = {
  confirmed: {
    label: 'Chờ xác nhận',
    description: 'Shop đã nhận đơn và đang kiểm tra tồn kho trước khi đóng gói.',
    color: colors.goldText,
    backgroundColor: colors.goldSoft,
  },
  packed: {
    label: 'Đang xử lý',
    description: 'Đơn đã được duyệt và đang chuẩn bị đóng gói hoặc chờ bàn giao vận chuyển.',
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
    label: 'Hoàn thành',
    description: 'Đơn đã giao thành công. Bạn có thể yêu cầu hỗ trợ đổi trả nếu cần.',
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
    label: 'Đang xử lý trả hàng',
    description: 'Yêu cầu trả hàng đã được ghi nhận và đang chờ shop phản hồi.',
    color: colors.coral,
    backgroundColor: '#FFF0EA',
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
  if (order.status === 'cancelled') {
    return `Đã hủy: ${formatDate(order.updatedAt)}`;
  }

  if (order.status === 'delivered') {
    return `Đã giao: ${formatDate(order.updatedAt)}`;
  }

  if (order.status === 'return_requested') {
    return 'Đang xử lý yêu cầu trả hàng';
  }

  if (order.status === 'returned') {
    return `Đã trả hàng: ${formatDate(order.updatedAt)}`;
  }

  return `Dự kiến giao: ${formatDate(getEstimatedDeliveryDate(order))}`;
};

export const canCancelOrder = (status: OrderStatus) =>
  status === 'confirmed' || status === 'packed';

export const canRequestReturn = (status: OrderStatus) =>
  status === 'delivered';

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
