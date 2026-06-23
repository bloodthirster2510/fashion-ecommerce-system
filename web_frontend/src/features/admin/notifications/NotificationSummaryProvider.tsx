import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NotificationSummaryContext } from './notification-summary-context'
import { getNotificationSummary } from './notification-summary.service'
import type { NotificationSummary } from './notification-summary.types'
import { ADMIN_NOTIFICATION_REFRESH_EVENT } from './notification-summary-events'

const POLL_INTERVAL_MS = 45_000

export function NotificationSummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)
  const activeRequest = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (activeRequest.current !== null) return
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    activeRequest.current = sequence
    setLoading(true)

    try {
      const nextSummary = await getNotificationSummary()
      if (sequence !== requestSequence.current) return
      setSummary(nextSummary)
      setError('')
    } catch (caughtError) {
      if (sequence !== requestSequence.current) return
      setError(caughtError instanceof Error ? caughtError.message : 'Không thể tải thông báo')
    } finally {
      if (activeRequest.current === sequence) activeRequest.current = null
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
    const handleOnline = () => void refresh()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener(ADMIN_NOTIFICATION_REFRESH_EVENT, handleRefreshRequest)
    window.addEventListener('online', handleOnline)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener(ADMIN_NOTIFICATION_REFRESH_EVENT, handleRefreshRequest)
      window.removeEventListener('online', handleOnline)
      requestSequence.current += 1
      activeRequest.current = null
    }
  }, [refresh])

  const value = useMemo(() => ({ summary, loading, error, refresh }), [summary, loading, error, refresh])

  return (
    <NotificationSummaryContext.Provider value={value}>
      {children}
    </NotificationSummaryContext.Provider>
  )
}
