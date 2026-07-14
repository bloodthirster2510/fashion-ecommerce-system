import { requestAdmin } from '../../services/adminHttp'
import type {
  StorefrontSettings,
  StorefrontSettingsUpdate,
} from '../../../storefront-settings/storefrontSettings.types'
import {
  fallbackStorefrontSettings,
  resolveStorefrontSettings,
} from '../../../storefront-settings/storefrontSettings.service'
import { getAdminSession } from '../auth/adminSession'

const isDemoMode = () => import.meta.env.DEV && getAdminSession()?.accessToken === 'demo-admin-access-token'

export const getStorefrontSettings = () => isDemoMode()
  ? Promise.resolve(fallbackStorefrontSettings)
  : requestAdmin<StorefrontSettings>('/admin/settings/storefront')
    .then((settings) => settings.configured ? settings : resolveStorefrontSettings(settings))

export const updateStorefrontSettings = (payload: StorefrontSettingsUpdate) => {
  if (isDemoMode()) {
    return Promise.reject(new Error('Không thể lưu dữ liệu trong chế độ xem bố cục demo.'))
  }
  return requestAdmin<StorefrontSettings>('/admin/settings/storefront', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
