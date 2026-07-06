import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: string[]
  actions?: ReactNode
}

export function PageHeader({ title, description, breadcrumbs = [], actions }: PageHeaderProps) {
  return (
    <header className="admin-ui-page-header">
      <div className="admin-ui-page-header__copy">
        {breadcrumbs.length ? (
          <nav className="admin-ui-breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((item) => <span key={item}>{item}</span>)}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-ui-page-header__actions">{actions}</div> : null}
    </header>
  )
}
