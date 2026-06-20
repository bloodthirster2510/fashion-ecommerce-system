import { createContext, useContext } from 'react'
import type { NotificationSummary } from './notification-summary.types'

export type NotificationSummaryContextValue = {
  summary: NotificationSummary | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
}

export const NotificationSummaryContext = createContext<NotificationSummaryContextValue | null>(null)

export const useNotificationSummary = () => {
  const context = useContext(NotificationSummaryContext)

  if (!context) {
    throw new Error('useNotificationSummary must be used within NotificationSummaryProvider')
  }

  return context
}
