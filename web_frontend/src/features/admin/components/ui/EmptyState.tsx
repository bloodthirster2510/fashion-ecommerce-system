import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  role?: 'status' | 'alert'
}

export function EmptyState({ title, description, action, role = 'status' }: EmptyStateProps) {
  return (
    <div className="admin-ui-empty-state" role={role}>
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  )
}
