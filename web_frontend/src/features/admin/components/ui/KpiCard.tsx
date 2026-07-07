import type { ReactNode } from 'react'

type KpiCardProps = {
  label: string
  value: string | number
  meta?: string
  icon?: ReactNode
  tone?: 'neutral' | 'success' | 'info' | 'warning' | 'accent'
}

export function KpiCard({ label, value, meta, icon, tone = 'neutral' }: KpiCardProps) {
  return (
    <article className={`admin-ui-kpi-card admin-ui-kpi-card--${tone}`}>
      <div className="admin-ui-kpi-card__header">
        <span className="admin-ui-kpi-card__label">{label}</span>
        {icon ? <span className="admin-ui-kpi-card__icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <strong className="admin-ui-kpi-card__value">{value}</strong>
      {meta ? <span className="admin-ui-kpi-card__meta">{meta}</span> : null}
    </article>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="admin-ui-kpi-grid">{children}</div>
}
