import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fallbackStorefrontSettings,
  fetchStorefrontSettings,
  readCachedStorefrontSettings,
} from './storefrontSettings.service'
import { StorefrontSettingsContext } from './storefrontSettings.context'

export function StorefrontSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => readCachedStorefrontSettings() ?? fallbackStorefrontSettings)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setSettings(await fetchStorefrontSettings())
    } catch {
      // Keep the last cached value or the bundled fallback when the API is unavailable.
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const handleRefresh = () => void refresh()
    window.addEventListener('storefront-settings:refresh', handleRefresh)
    return () => window.removeEventListener('storefront-settings:refresh', handleRefresh)
  }, [refresh])

  const value = useMemo(() => ({ settings, isLoading, refresh }), [isLoading, refresh, settings])
  return <StorefrontSettingsContext.Provider value={value}>{children}</StorefrontSettingsContext.Provider>
}
