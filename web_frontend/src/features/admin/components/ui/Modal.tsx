import { useEffect, useRef, type ReactNode } from 'react'

type ModalProps = {
  title: string
  description?: string
  className?: string
  isOpen: boolean
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
}

export function Modal({ title, description, className = '', isOpen, onClose, children, actions }: ModalProps) {
  const modalRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFrame = window.requestAnimationFrame(() => modalRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="admin-ui-modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section ref={modalRef} className={`admin-ui-modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
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
