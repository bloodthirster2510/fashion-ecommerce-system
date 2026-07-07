import { BadgePercent, Eye, Gauge, TicketCheck } from 'lucide-react'
import { KpiCard, KpiGrid } from '../../../components/ui'

type PromotionSummary = {
  totalCoupons: number
  usedCount: number
  activeCount: number
  publicCount: number
}

type PromotionKpiSummaryProps = {
  summary: PromotionSummary
  hasKeyword: boolean
  formatNumber: (value: number) => string
}

export function PromotionKpiSummary({
  summary,
  hasKeyword,
  formatNumber,
}: PromotionKpiSummaryProps) {
  return (
    <KpiGrid>
      <KpiCard
        label="Tổng voucher"
        value={formatNumber(summary.totalCoupons)}
        meta={hasKeyword ? 'Theo từ khóa hiện tại' : 'Tất cả chiến dịch'}
        tone="info"
        icon={<TicketCheck />}
      />
      <KpiCard
        label="Đang chạy"
        value={formatNumber(summary.activeCount)}
        meta="Có thể áp dụng cho đơn hợp lệ"
        tone="success"
        icon={<Gauge />}
      />
      <KpiCard
        label="Đã sử dụng"
        value={formatNumber(summary.usedCount)}
        meta="Tổng lượt dùng trong kết quả lọc"
        tone="warning"
        icon={<BadgePercent />}
      />
      <KpiCard
        label="Công khai"
        value={formatNumber(summary.publicCount)}
        meta="Voucher hiển thị cho khách"
        tone="accent"
        icon={<Eye />}
      />
    </KpiGrid>
  )
}
