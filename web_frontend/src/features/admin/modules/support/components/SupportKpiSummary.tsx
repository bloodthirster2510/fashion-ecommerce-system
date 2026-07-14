import { AlertTriangle, CheckCircle, Clock, Headphones, MessageCircle } from 'lucide-react'
import { KpiCard, KpiGrid } from '../../../components/ui'
import type { SupportSummary } from '../support.types'

type SupportKpiSummaryProps = {
  summary: SupportSummary | null
}

export function SupportKpiSummary({ summary }: SupportKpiSummaryProps) {
  return (
    <KpiGrid>
      <KpiCard label="Đang mở" value={summary?.totalOpen ?? 0} meta="Ticket chưa hoàn tất" tone="info" icon={<Headphones />} />
      <KpiCard label="Chờ phản hồi" value={summary?.waitingAdmin ?? 0} meta="Cần CSKH xử lý" tone="warning" icon={<MessageCircle />} />
      <KpiCard label="Chờ khách" value={summary?.waitingCustomer ?? 0} meta="Đang đợi khách bổ sung" tone="accent" icon={<Clock />} />
      <KpiCard label="Đã giải quyết" value={summary?.resolved ?? 0} meta="Còn trong thời hạn mở lại" tone="success" icon={<CheckCircle />} />
      <KpiCard label="Quá 24 giờ" value={summary?.overdue ?? 0} meta="Cần ưu tiên kiểm tra" tone="warning" icon={<AlertTriangle />} />
    </KpiGrid>
  )
}
