import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { NotificationContext, type ToastAction, type ToastType } from './notification-context'
type ToastPlacement = 'top-right' | 'bottom-right'
type Toast = { id: number; message: string; type: ToastType; action?: ToastAction; placement: ToastPlacement }

const toastPresentation: Record<ToastType, { title: string; icon: typeof CircleCheck }> = {
  success: { title: 'Đã hoàn tất', icon: CircleCheck },
  info: { title: 'Thông tin', icon: Info },
  warning: { title: 'Cần lưu ý', icon: TriangleAlert },
  error: { title: 'Chưa thực hiện được', icon: CircleAlert },
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])
  const enqueueToast = useCallback((
    message: string,
    type: ToastType,
    placement: ToastPlacement,
    action?: ToastAction,
  ) => {
    const id = nextId.current
    nextId.current += 1
    setToasts((current) => [...current.slice(-2), { id, message, type, action, placement }])
    window.setTimeout(() => dismissToast(id), type === 'error' || type === 'warning' ? 8000 : 5000)
  }, [dismissToast])
  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction) =>
      enqueueToast(message, type, 'top-right', action),
    [enqueueToast],
  )
  const showBottomToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction) =>
      enqueueToast(message, type, 'bottom-right', action),
    [enqueueToast],
  )
  const value = useMemo(
    () => ({ showToast, showBottomToast, dismissToast }),
    [dismissToast, showBottomToast, showToast],
  )

  const renderToastViewport = (placement: ToastPlacement) => (
    <div
      className={`admin-toast-container${placement === 'bottom-right' ? ' is-bottom' : ''}`}
      aria-live="polite"
      aria-atomic="true"
      aria-label={placement === 'bottom-right' ? 'Thông báo tác vụ' : 'Thông báo hệ thống'}
    >
      {toasts.filter((toast) => toast.placement === placement).map((toast) => {
        const presentation = toastPresentation[toast.type]
        const Icon = presentation.icon

        return (
          <div className={`admin-toast is-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} key={toast.id}>
            <span className="admin-toast-icon" aria-hidden="true"><Icon size={18} /></span>
            <span className="admin-toast-copy">
              <strong>{presentation.title}</strong>
              <span>{toast.message}</span>
              {toast.action ? (
                <button
                  className="admin-toast-action"
                  type="button"
                  onClick={() => {
                    toast.action?.onClick()
                    dismissToast(toast.id)
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </span>
            <button className="admin-toast-close" type="button" aria-label="Đóng thông báo" onClick={() => dismissToast(toast.id)}><X size={16} /></button>
          </div>
        )
      })}
    </div>
  )

  const toastViewports = (
    <>
      {renderToastViewport('top-right')}
      {renderToastViewport('bottom-right')}
    </>
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {createPortal(toastViewports, document.body)}
    </NotificationContext.Provider>
  )
}
