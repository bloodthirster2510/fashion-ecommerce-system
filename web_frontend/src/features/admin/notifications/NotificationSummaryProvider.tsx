import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NotificationSummaryContext } from './notification-summary-context'
import { getNotificationSummary } from './notification-summary.service'
import type { NotificationSummary } from './notification-summary.types'

const POLL_INTERVAL_MS = 45_000
export const ADMIN_NOTIFICATION_REFRESH_EVENT = 'admin:notifications:refresh'

export function NotificationSummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const refresh = useCallback(async () => {
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence

    try {
      const nextSummary = await getNotificationSummary()
      if (sequence !== requestSequence.current) return
      setSummary(nextSummary)
      setError('')
    } catch (caughtError) {
      if (sequence !== requestSequence.current) return
      setError(caughtError instanceof Error ? caughtError.message : 'Không thể tải thông báo')
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const handleRefreshRequest = () => void refresh()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener(ADMIN_NOTIFICATION_REFRESH_EVENT, handleRefreshRequest)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener(ADMIN_NOTIFICATION_REFRESH_EVENT, handleRefreshRequest)
      requestSequence.current += 1
    }
  }, [refresh])

  const value = useMemo(() => ({ summary, loading, error, refresh }), [summary, loading, error, refresh])

  return (
    <NotificationSummaryContext.Provider value={value}>
      {children}
    </NotificationSummaryContext.Provider>
  )
}
