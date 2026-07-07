import { KpiCard, KpiGrid } from '../../../components/ui'
import type { ManagedUserSummary } from '../customer.types'

type CustomerKpiSummaryProps = {
  summary: ManagedUserSummary
  isLoading: boolean
  meta: string
}

const formatNumber = (value: number) => value.toLocaleString('vi-VN')

const formatPercent = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 1,
  }).format(value)

export function CustomerKpiSummary({ summary, isLoading, meta }: CustomerKpiSummaryProps) {
  const completedProfileRate = summary.total > 0
    ? (summary.completedProfiles / summary.total) * 100
    : 0

  return (
    <KpiGrid>
      <KpiCard
        label="Tổng khách hàng"
        value={isLoading ? '...' : formatNumber(summary.total)}
        meta={meta}
      />
      <KpiCard
        label="Hoạt động 30 ngày"
        value={isLoading ? '...' : formatNumber(summary.activeLast30Days)}
        meta="Có tương tác gần đây"
      />
      <KpiCard
        label="Khách mới 7 ngày"
        value={isLoading ? '...' : formatNumber(summary.newLast7Days)}
        meta="Tài khoản mới tạo"
      />
      <KpiCard
        label="Hồ sơ hoàn chỉnh"
        value={isLoading ? '...' : formatNumber(summary.completedProfiles)}
        meta={`${formatPercent(completedProfileRate)}% trên nhóm đang lọc`}
      />
    </KpiGrid>
  )
}
