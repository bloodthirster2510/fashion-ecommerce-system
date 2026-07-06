import type { ReactNode } from 'react'
import { Button } from './Button'

type DrawerProps = {
  title: string
  description?: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({ title, description, isOpen, onClose, children, footer }: DrawerProps) {
  if (!isOpen) return null

  return (
    <div className="admin-ui-drawer-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="admin-ui-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="admin-ui-drawer__header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <Button variant="ghost" iconOnly icon={<span aria-hidden="true">×</span>} onClick={onClose}>Đóng</Button>
        </header>
        <div className="admin-ui-drawer__body">{children}</div>
        {footer ? <footer className="admin-ui-drawer__footer">{footer}</footer> : null}
      </aside>
    </div>
  )
}
