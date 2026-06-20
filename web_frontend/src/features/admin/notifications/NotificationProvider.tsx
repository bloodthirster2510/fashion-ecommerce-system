import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { NotificationContext, type ToastType } from './notification-context'
type Toast = { id: number; message: string; type: ToastType }
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current
    nextId.current += 1
    setToasts((current) => [...current.slice(-3), { id, message, type }])
    window.setTimeout(() => dismissToast(id), type === 'error' ? 8000 : 5000)
  }, [dismissToast])
  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="admin-toast-container" aria-live="polite" aria-label="Thông báo hệ thống">
        {toasts.map((toast) => (
          <div className={`admin-toast is-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} key={toast.id}>
            <span>{toast.message}</span>
            <button className="admin-toast-close" type="button" aria-label="Đóng thông báo" onClick={() => dismissToast(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
