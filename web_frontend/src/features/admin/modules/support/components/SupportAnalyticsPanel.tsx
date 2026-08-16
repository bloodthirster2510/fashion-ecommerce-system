import { BarChart2, Calendar, CheckCircle, Clock, FileCheck, HelpCircle, MessageSquare, TrendingUp } from 'lucide-react'
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
  const totalTickets = analytics?.tickets.total ?? 0
  const respondedTickets = analytics?.tickets.responded ?? 0
  const responseRate = totalTickets > 0 ? Math.round((respondedTickets / totalTickets) * 100) : 0
  const faqHelpfulRate = Math.round((analytics?.faq.helpfulRate ?? 0) * 100)

  return (
    <section className="admin-support-analytics-wrapper">
      {/* TOOLBAR */}
      <div className="admin-support-analytics-toolbar">
        <div className="admin-support-date-range">
          <label className="admin-support-date-field">
            <Calendar aria-hidden="true" />
            <span>Từ ngày:</span>
            <input
              type="date"
              aria-label="Từ ngày"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
            />
          </label>

          <label className="admin-support-date-field">
            <Calendar aria-hidden="true" />
            <span>Đến ngày:</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
            />
          </label>
        </div>

        <Button variant="primary" onClick={() => void onApply()}>
          <TrendingUp aria-hidden="true" />
          Áp dụng bộ lọc
        </Button>
      </div>

      {/* PRIMARY KPI METRICS */}
      <div className="admin-support-analytics-kpis">
        <article className="admin-support-analytics-kpi-card">
          <div className="admin-support-analytics-kpi-card__icon is-blue">
            <MessageSquare aria-hidden="true" />
          </div>
          <div className="admin-support-analytics-kpi-card__content">
            <span>Tổng số ticket</span>
            <strong>{totalTickets}</strong>
            <small>Tất cả yêu cầu gửi về</small>
          </div>
        </article>

        <article className="admin-support-analytics-kpi-card">
          <div className="admin-support-analytics-kpi-card__icon is-green">
            <CheckCircle aria-hidden="true" />
          </div>
          <div className="admin-support-analytics-kpi-card__content">
            <span>Đã phản hồi</span>
            <strong>{respondedTickets}</strong>
            <small>Đạt tỷ lệ {responseRate}%</small>
          </div>
        </article>

        <article className="admin-support-analytics-kpi-card">
          <div className="admin-support-analytics-kpi-card__icon is-amber">
            <Clock aria-hidden="true" />
          </div>
          <div className="admin-support-analytics-kpi-card__content">
            <span>Phản hồi đầu TB</span>
            <strong>{formatDuration(analytics?.tickets.avgFirstResponseMs)}</strong>
            <small>Tốc độ tiếp nhận</small>
          </div>
        </article>

        <article className="admin-support-analytics-kpi-card">
          <div className="admin-support-analytics-kpi-card__icon is-purple">
            <FileCheck aria-hidden="true" />
          </div>
          <div className="admin-support-analytics-kpi-card__content">
            <span>Thời gian xử lý TB</span>
            <strong>{formatDuration(analytics?.tickets.avgResolutionMs)}</strong>
            <small>Đến khi giải quyết xong</small>
          </div>
        </article>
      </div>

      {/* BREAKDOWN GRIDS */}
      <div className="admin-support-analytics-grid">
        <ReportBreakdownCard
          title="Phân bổ theo danh mục"
          items={(analytics?.byCategory ?? []).map((item) => ({
            label: categoryLabels[item.key] ?? item.key,
            count: item.count,
          }))}
        />

        <ReportBreakdownCard
          title="Phân bổ theo loại yêu cầu"
          items={(analytics?.byType ?? []).map((item) => ({
            label: typeLabels[item.key] ?? item.key,
            count: item.count,
          }))}
        />

        <ReportBreakdownCard
          title="Lượng ticket theo ngày"
          items={(analytics?.dailyVolume ?? []).map((item) => ({
            label: item.date,
            count: item.count,
          }))}
        />

        <article className="admin-support-analytics-card is-faq-card">
          <div className="admin-support-analytics-card__header">
            <HelpCircle aria-hidden="true" />
            <h3>Hiệu quả bài viết FAQ</h3>
          </div>
          <div className="admin-support-faq-metric">
            <strong className="admin-support-faq-metric__percent">{faqHelpfulRate}%</strong>
            <span className="admin-support-faq-metric__label">Tỷ lệ khách đánh giá hữu ích</span>
            <p className="admin-support-faq-metric__details">
              Đã ghi nhận <b>{analytics?.faq.helpful ?? 0}</b> lượt đánh giá tốt trên tổng số{' '}
              <b>{analytics?.faq.totalVotes ?? 0}</b> lượt vote từ khách hàng.
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}

function ReportBreakdownCard({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; count: number }>
}) {
  const max = Math.max(1, ...items.map((item) => item.count))

  return (
    <article className="admin-support-analytics-card">
      <div className="admin-support-analytics-card__header">
        <BarChart2 aria-hidden="true" />
        <h3>{title}</h3>
      </div>

      <div className="admin-support-breakdown-list">
        {items.length ? (
          items.map((item) => {
            const percentage = Math.round((item.count / max) * 100)
            return (
              <div className="admin-support-breakdown-row" key={item.label}>
                <span className="admin-support-breakdown-label">{item.label}</span>
                <div className="admin-support-breakdown-track">
                  <div
                    className="admin-support-breakdown-bar"
                    style={{ width: `${percentage}%` }}
                    title={`${item.count} ticket (${percentage}%)`}
                  />
                </div>
                <strong className="admin-support-breakdown-count">{item.count}</strong>
              </div>
            )
          })
        ) : (
          <p className="admin-support-breakdown-empty">Chưa có dữ liệu thống kê trong khoảng thời gian này.</p>
        )}
      </div>
    </article>
  )
}
