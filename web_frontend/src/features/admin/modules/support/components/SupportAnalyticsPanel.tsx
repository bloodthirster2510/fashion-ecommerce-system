import { Button } from '../../../components/ui'
import type { SupportAnalytics, SupportCategory, SupportTicketType } from '../support.types'

type SupportAnalyticsPanelProps = {
  analytics: SupportAnalytics | null
  dateFrom: string
  dateTo: string
  categoryLabels: Record<SupportCategory, string>
  typeLabels: Record<SupportTicketType, string>
  formatDuration: (value?: number) => string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onApply: () => void | Promise<void>
}

export function SupportAnalyticsPanel({
  analytics,
  dateFrom,
  dateTo,
  categoryLabels,
  typeLabels,
  formatDuration,
  onDateFromChange,
  onDateToChange,
  onApply,
}: SupportAnalyticsPanelProps) {
  return (
    <section className="admin-support-report">
      <div className="admin-support-toolbar">
        <label>Từ ngày<input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} /></label>
        <label>Đến ngày<input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} /></label>
        <Button variant="primary" onClick={() => void onApply()}>Áp dụng</Button>
      </div>
      <div className="admin-support-kpis">
        <ReportKpi label="Tổng ticket" value={analytics?.tickets.total ?? 0} />
        <ReportKpi label="Đã phản hồi" value={analytics?.tickets.responded ?? 0} />
        <ReportKpi label="Phản hồi đầu" value={formatDuration(analytics?.tickets.avgFirstResponseMs)} />
        <ReportKpi label="Thời gian xử lý" value={formatDuration(analytics?.tickets.avgResolutionMs)} />
      </div>
      <div className="admin-support-report-grid">
        <ReportBreakdown title="Theo danh mục" items={(analytics?.byCategory ?? []).map((item) => ({ label: categoryLabels[item.key], count: item.count }))} />
        <ReportBreakdown title="Theo loại" items={(analytics?.byType ?? []).map((item) => ({ label: typeLabels[item.key], count: item.count }))} />
        <ReportBreakdown title="Lượng ticket theo ngày" items={(analytics?.dailyVolume ?? []).map((item) => ({ label: item.date, count: item.count }))} />
        <article className="admin-support-report-card"><h3>FAQ hữu ích</h3><strong>{Math.round((analytics?.faq.helpfulRate ?? 0) * 100)}%</strong><p>{analytics?.faq.helpful ?? 0}/{analytics?.faq.totalVotes ?? 0} lượt đánh giá hữu ích</p></article>
      </div>
    </section>
  )
}

function ReportKpi({ label, value }: { label: string; value: number | string }) {
  return <article className="admin-support-kpi"><span>{label}</span><strong>{value}</strong></article>
}

function ReportBreakdown({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return <article className="admin-support-report-card"><h3>{title}</h3>{items.length ? items.map((item) => <div className="admin-support-report-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.count / max * 100}%` }} /></i><strong>{item.count}</strong></div>) : <p>Chưa có dữ liệu.</p>}</article>
}
