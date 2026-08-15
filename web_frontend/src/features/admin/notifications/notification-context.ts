import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'info' | 'warning' | 'error'
export type ToastAction = {
  label: string
  onClick: () => void
}
export type NotificationContextValue = {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void
  showBottomToast: (message: string, type?: ToastType, action?: ToastAction) => void
  dismissToast: (id: number) => void
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

export const useToast = () => {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useToast must be used inside NotificationProvider')
  return context
}
