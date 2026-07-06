import type { ReactNode } from 'react'

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

type StatusBadgeProps = {
  tone?: StatusTone
  children: ReactNode
}

export function StatusBadge({ tone = 'neutral', children }: StatusBadgeProps) {
  return <span className={`admin-ui-status admin-ui-status--${tone}`}>{children}</span>
}
