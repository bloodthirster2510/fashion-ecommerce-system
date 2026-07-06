import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  description?: string
  isOpen: boolean
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
}

export function Modal({ title, description, isOpen, onClose, children, actions }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="admin-ui-modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="admin-ui-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
        {actions ? <div className="admin-ui-modal__actions">{actions}</div> : null}
      </section>
    </div>
  )
}
