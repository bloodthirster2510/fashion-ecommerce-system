import type { NotificationSummary } from '../../notifications/notification-summary.types'

export type DashboardAttentionKey =
  | 'payment-deadline'
  | 'packing'
  | 'handoff'
  | 'returns'
  | 'support'
  | 'inventory'
  | 'reviews'
  | 'coupons'

export type DashboardAttentionItem = {
  key: DashboardAttentionKey
  title: string
  detail: string
  count: number
  href: string
  tone: 'danger' | 'warning' | 'info'
}

export const buildDashboardAttentionItems = (
  summary: NotificationSummary | null,
): DashboardAttentionItem[] => {
  if (!summary) return []

  const items: Array<DashboardAttentionItem | null> = [
    summary.capabilities.orders && summary.paymentDeadlineSoon > 0 ? {
      key: 'payment-deadline',
      title: 'Thanh toán sắp hết hạn',
      detail: 'Đơn online có nguy cơ tự hủy trong 24 giờ tới.',
      count: summary.paymentDeadlineSoon,
      href: '/admin/orders?queue=payment-deadline',
      tone: 'warning',
    } : null,
    summary.capabilities.orders && summary.orders.confirmed > 0 ? {
      key: 'packing',
      title: 'Đơn chờ đóng gói',
      detail: 'Đơn đã xác nhận và đủ điều kiện xử lý.',
      count: summary.orders.confirmed,
      href: '/admin/orders?queue=packing',
      tone: 'danger',
    } : null,
    summary.capabilities.orders && summary.orders.packed > 0 ? {
      key: 'handoff',
      title: 'Đơn chờ bàn giao',
      detail: 'Đơn đã đóng gói, cần chuyển sang vận chuyển.',
      count: summary.orders.packed,
      href: '/admin/orders?queue=handoff',
      tone: 'danger',
    } : null,
    summary.capabilities.orders && summary.orders.returnRequested > 0 ? {
      key: 'returns',
      title: 'Yêu cầu trả hàng',
      detail: 'Khách hàng đang chờ quyết định hoàn trả.',
      count: summary.orders.returnRequested,
      href: '/admin/orders?queue=review',
      tone: 'danger',
    } : null,
    summary.capabilities.support && summary.supportOpen > 0 ? {
      key: 'support',
      title: 'Ticket chờ phản hồi',
      detail: 'Khách hàng đang chờ nhân viên hỗ trợ.',
      count: summary.supportOpen,
      href: '/admin/support',
      tone: 'danger',
    } : null,
    summary.capabilities.inventory && summary.lowStockVariants > 0 ? {
      key: 'inventory',
      title: 'Mặt hàng tồn kho thấp',
      detail: 'Biến thể còn từ 1 đến 5 sản phẩm khả dụng.',
      count: summary.lowStockVariants,
      href: '/admin/inventory',
      tone: 'warning',
    } : null,
    summary.capabilities.reviews && summary.reviewsPending > 0 ? {
      key: 'reviews',
      title: 'Đánh giá chờ duyệt',
      detail: 'Nội dung cần kiểm tra trước khi hiển thị.',
      count: summary.reviewsPending,
      href: '/admin/reviews',
      tone: 'info',
    } : null,
    summary.capabilities.promotions && summary.expiringCoupons > 0 ? {
      key: 'coupons',
      title: 'Voucher sắp hết hạn',
      detail: 'Chiến dịch sẽ kết thúc trong 3 ngày tới.',
      count: summary.expiringCoupons,
      href: '/admin/promotions',
      tone: 'info',
    } : null,
  ]

  return items
    .filter((item): item is DashboardAttentionItem => item !== null)
    .slice(0, 6)
}
