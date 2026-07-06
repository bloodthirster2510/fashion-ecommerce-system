import type { ReactNode } from 'react'

type KpiCardProps = {
  label: string
  value: string | number
  meta?: string
}

export function KpiCard({ label, value, meta }: KpiCardProps) {
  return (
    <article className="admin-ui-kpi-card">
      <span className="admin-ui-kpi-card__label">{label}</span>
      <strong className="admin-ui-kpi-card__value">{value}</strong>
      {meta ? <span className="admin-ui-kpi-card__meta">{meta}</span> : null}
    </article>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="admin-ui-kpi-grid">{children}</div>
}
