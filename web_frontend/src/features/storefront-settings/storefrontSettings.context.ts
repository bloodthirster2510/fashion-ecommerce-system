import { createContext, useContext } from 'react'
import type { StorefrontSettings } from './storefrontSettings.types'

export type StorefrontSettingsContextValue = {
  settings: StorefrontSettings
  isLoading: boolean
  refresh: () => Promise<void>
}

export const StorefrontSettingsContext = createContext<StorefrontSettingsContextValue | null>(null)

export const useStorefrontSettings = () => {
  const context = useContext(StorefrontSettingsContext)
  if (!context) throw new Error('useStorefrontSettings must be used inside StorefrontSettingsProvider')
  return context
}
