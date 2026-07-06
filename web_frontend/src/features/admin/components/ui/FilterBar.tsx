import type { ReactNode } from 'react'

type FilterBarProps = {
  children: ReactNode
  actions?: ReactNode
}

export function FilterBar({ children, actions }: FilterBarProps) {
  return (
    <section className="admin-ui-filter-bar" aria-label="Bộ lọc">
      <div className="admin-ui-filter-bar__fields">{children}</div>
      {actions ? <div className="admin-ui-filter-bar__actions">{actions}</div> : null}
    </section>
  )
}

type FieldProps = {
  label: string
  children: ReactNode
  grow?: boolean
}

export function Field({ label, children, grow = false }: FieldProps) {
  return (
    <label className={`admin-ui-field${grow ? ' admin-ui-field--grow' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}
