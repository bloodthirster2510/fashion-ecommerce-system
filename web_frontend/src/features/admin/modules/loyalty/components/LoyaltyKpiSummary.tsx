import { KpiCard, KpiGrid } from '../../../components/ui'
import type { MembershipRanking } from '../loyalty.types'

type LoyaltyKpiSummaryProps = {
  tiers: MembershipRanking[]
  formatNumber: (value: number | null | undefined) => string
}

export function LoyaltyKpiSummary({ tiers, formatNumber }: LoyaltyKpiSummaryProps) {
  const activeTierCount = tiers.filter((tier) => tier.isActive !== false).length
  const highestTier = tiers[tiers.length - 1]
  const totalTierMembers = tiers.reduce((total, tier) => total + (tier.memberCount ?? 0), 0)
  const highestDiscountPercent = tiers.reduce(
    (highestDiscount, tier) => Math.max(highestDiscount, tier.discountPercent),
    0,
  )

  return (
    <KpiGrid>
      <KpiCard
        label="Tổng hạng"
        value={formatNumber(tiers.length)}
        meta={`${formatNumber(activeTierCount)} hạng đang áp dụng`}
      />
      <KpiCard
        label="Hạng cao nhất"
        value={highestTier?.name ?? 'Chưa có'}
        meta={highestTier ? `Từ ${formatNumber(highestTier.minPoint)} điểm` : 'Chưa cấu hình'}
      />
      <KpiCard
        label="Ưu đãi tối đa"
        value={`${highestDiscountPercent}%`}
        meta="Theo cấu hình hạng hiện tại"
      />
      <KpiCard
        label="Thành viên đã xếp hạng"
        value={formatNumber(totalTierMembers)}
        meta="Tổng theo dữ liệu từng hạng"
      />
    </KpiGrid>
  )
}
