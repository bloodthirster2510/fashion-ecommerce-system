import type { SupportSummary } from '../support.types'

type SupportKpiSummaryProps = {
  summary: SupportSummary | null
}

export function SupportKpiSummary({ summary }: SupportKpiSummaryProps) {
  return (
    <section className="admin-support-overview" aria-labelledby="support-queue-overview">
      <div className="admin-support-overview-heading">
        <div>
          <span>Hàng đợi</span>
          <h2 id="support-queue-overview">{summary?.totalOpen ?? 0} ticket đang mở</h2>
        </div>
        <p>Cập nhật theo thời gian thực</p>
      </div>
      <div className="admin-support-overview-focus">
        <article className="is-primary">
          <span>Cần phản hồi</span>
          <strong>{summary?.waitingAdmin ?? 0}</strong>
          <small>Ưu tiên của staff</small>
        </article>
        <article className="is-unassigned">
          <span>Chưa phân công</span>
          <strong>{summary?.unassigned ?? 0}</strong>
          <small>Cần người nhận</small>
        </article>
        <article className={`is-overdue${(summary?.overdue ?? 0) > 0 ? ' has-alert' : ''}`}>
          <span>Quá 24 giờ</span>
          <strong>{summary?.overdue ?? 0}</strong>
          <small>Cần kiểm tra SLA</small>
        </article>
      </div>
      <div className="admin-support-overview-secondary" aria-label="Trạng thái tham khảo">
        <span className="is-waiting">Chờ khách <strong>{summary?.waitingCustomer ?? 0}</strong></span>
        <span className="is-resolved">Đã giải quyết <strong>{summary?.resolved ?? 0}</strong></span>
      </div>
    </section>
  )
}
