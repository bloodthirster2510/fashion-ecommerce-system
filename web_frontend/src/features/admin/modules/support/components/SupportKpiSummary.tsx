import { AlertCircle, Clock, Flame, Inbox, UserCheck } from 'lucide-react'
import type { SupportSummary } from '../support.types'

type SupportKpiSummaryProps = {
  summary: SupportSummary | null
  activeView?: string
  onSelectKpi?: (view: 'all' | 'reply' | 'unassigned' | 'overdue') => void
}

export function SupportKpiSummary({ summary, activeView, onSelectKpi }: SupportKpiSummaryProps) {
  const totalOpen = summary?.totalOpen ?? 0
  const waitingAdmin = summary?.waitingAdmin ?? 0
  const unassigned = summary?.unassigned ?? 0
  const overdue = summary?.overdue ?? 0

  return (
    <section className="admin-support-kpi-bar" aria-labelledby="support-queue-overview">
      <div className="admin-support-kpi-bar__header sr-only">
        <h2 id="support-queue-overview">Tổng quan hàng đợi hỗ trợ</h2>
      </div>

      <div className="admin-support-kpi-grid">
        <button
          type="button"
          className={`admin-support-kpi-card is-all${activeView === 'all' ? ' is-active' : ''}`}
          onClick={() => onSelectKpi?.('all')}
          title="Xem tất cả ticket đang mở"
        >
          <div className="admin-support-kpi-card__icon">
            <Inbox aria-hidden="true" />
          </div>
          <div className="admin-support-kpi-card__content">
            <span className="admin-support-kpi-card__label">Đang mở</span>
            <strong className="admin-support-kpi-card__value">{totalOpen}</strong>
          </div>
          <span className="admin-support-kpi-card__sub">Tổng hàng đợi</span>
        </button>

        <button
          type="button"
          className={`admin-support-kpi-card is-urgent${waitingAdmin > 0 ? ' has-alert' : ''}${activeView === 'reply' ? ' is-active' : ''}`}
          onClick={() => onSelectKpi?.('reply')}
          title="Xem danh sách ticket cần nhân viên phản hồi"
        >
          <div className="admin-support-kpi-card__icon">
            <Flame aria-hidden="true" />
          </div>
          <div className="admin-support-kpi-card__content">
            <span className="admin-support-kpi-card__label">Cần phản hồi</span>
            <strong className="admin-support-kpi-card__value">{waitingAdmin}</strong>
          </div>
          <span className="admin-support-kpi-card__sub">Ưu tiên xử lý</span>
        </button>

        <button
          type="button"
          className={`admin-support-kpi-card is-unassigned${unassigned > 0 ? ' has-pending' : ''}${activeView === 'unassigned' ? ' is-active' : ''}`}
          onClick={() => onSelectKpi?.('unassigned')}
          title="Xem danh sách ticket chưa được phân công"
        >
          <div className="admin-support-kpi-card__icon">
            <UserCheck aria-hidden="true" />
          </div>
          <div className="admin-support-kpi-card__content">
            <span className="admin-support-kpi-card__label">Chưa phân công</span>
            <strong className="admin-support-kpi-card__value">{unassigned}</strong>
          </div>
          <span className="admin-support-kpi-card__sub">Cần nhận việc</span>
        </button>

        <button
          type="button"
          className={`admin-support-kpi-card is-overdue${overdue > 0 ? ' has-danger' : ''}${activeView === 'overdue' ? ' is-active' : ''}`}
          onClick={() => onSelectKpi?.('overdue')}
          title="Xem danh sách ticket quá hạn 24 giờ"
        >
          <div className="admin-support-kpi-card__icon">
            {overdue > 0 ? <AlertCircle aria-hidden="true" /> : <Clock aria-hidden="true" />}
          </div>
          <div className="admin-support-kpi-card__content">
            <span className="admin-support-kpi-card__label">Quá 24 giờ</span>
            <strong className="admin-support-kpi-card__value">{overdue}</strong>
          </div>
          <span className="admin-support-kpi-card__sub">Cảnh báo SLA</span>
        </button>
      </div>
    </section>
  )
}
