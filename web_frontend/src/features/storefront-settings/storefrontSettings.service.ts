import { axiosClient } from '../../services/axiosClient'
import {
  storefrontSocialPlatforms,
  type StorefrontSettings,
  type StorefrontSocialLink,
  type StorefrontSocialPlatform,
} from './storefrontSettings.types'

type ApiResponse<T> = { message?: string; data?: T }

const CACHE_KEY = 'storefront.settings.v1'

const env = (value: string | undefined) => value?.trim() || ''
const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
const safeHttpsEnv = (value: string | undefined) => {
  const normalized = env(value)
  return normalized && isHttpsUrl(normalized) ? new URL(normalized).toString() : ''
}
const fallbackName = env(import.meta.env.VITE_SHOP_NAME) || 'CDShop'
const fallbackLegalName = env(import.meta.env.VITE_SHOP_LEGAL_NAME) || fallbackName
const fallbackDescription = env(import.meta.env.VITE_SHOP_DESCRIPTION)
  || `${fallbackName} mang đến các lựa chọn thời trang nam nữ dễ mặc, hiện đại và phù hợp cho nhiều dịp hằng ngày.`

const fallbackSocialCandidates: Array<[StorefrontSocialPlatform, string, string]> = [
  ['facebook', 'Facebook', safeHttpsEnv(import.meta.env.VITE_FACEBOOK_URL)],
  ['instagram', 'Instagram', safeHttpsEnv(import.meta.env.VITE_INSTAGRAM_URL)],
  ['tiktok', 'TikTok', safeHttpsEnv(import.meta.env.VITE_TIKTOK_URL)],
  ['youtube', 'YouTube', safeHttpsEnv(import.meta.env.VITE_YOUTUBE_URL)],
  ['zalo', 'Zalo', safeHttpsEnv(import.meta.env.VITE_ZALO_URL)],
]

const fallbackSocials: StorefrontSocialLink[] = fallbackSocialCandidates
  .filter(([, , url]) => Boolean(url))
  .map(([platform, label, url], sortOrder) => ({ platform, label, url, enabled: true, sortOrder }))

export const fallbackStorefrontSettings: StorefrontSettings = {
  configured: false,
  identity: {
    name: fallbackName,
    avatarUrl: safeHttpsEnv(import.meta.env.VITE_SHOP_AVATAR_URL),
    legalName: fallbackLegalName,
    taxCode: env(import.meta.env.VITE_SHOP_TAX_CODE),
    tagline: env(import.meta.env.VITE_SHOP_TAGLINE) || 'Mặc đúng gu. Tự tin theo cách của bạn.',
    description: fallbackDescription,
  },
  contact: {
    phone: env(import.meta.env.VITE_SHOP_PHONE) || '0123 456 789',
    email: env(import.meta.env.VITE_SHOP_EMAIL) || 'cuahang@gmail.com',
    hours: env(import.meta.env.VITE_SHOP_HOURS) || '08:30 – 21:45 mỗi ngày',
    address: env(import.meta.env.VITE_SHOP_ADDRESS),
    mapUrl: safeHttpsEnv(import.meta.env.VITE_SHOP_MAP_URL),
  },
  socials: fallbackSocials,
  version: 0,
  updatedAt: null,
}

const preferValue = (serverValue: string, fallbackValue: string) => serverValue.trim() || fallbackValue

export const resolveStorefrontSettings = (settings: StorefrontSettings): StorefrontSettings => {
  const visibleSocials = settings.socials
    .filter((social) => social.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (settings.configured) {
    return {
      ...settings,
      socials: visibleSocials,
    }
  }

  const resolvedName = preferValue(settings.identity.name, fallbackStorefrontSettings.identity.name)
  const resolvedDescription = settings.identity.description.trim()
    || env(import.meta.env.VITE_SHOP_DESCRIPTION)
    || `${resolvedName} mang đến các lựa chọn thời trang nam nữ dễ mặc, hiện đại và phù hợp cho nhiều dịp hằng ngày.`

  return {
    ...settings,
    identity: {
      name: resolvedName,
      avatarUrl: preferValue(settings.identity.avatarUrl, fallbackStorefrontSettings.identity.avatarUrl),
      legalName: settings.identity.legalName.trim() || env(import.meta.env.VITE_SHOP_LEGAL_NAME) || resolvedName,
      taxCode: preferValue(settings.identity.taxCode, fallbackStorefrontSettings.identity.taxCode),
      tagline: preferValue(settings.identity.tagline, fallbackStorefrontSettings.identity.tagline),
      description: resolvedDescription,
    },
    contact: {
      phone: preferValue(settings.contact.phone, fallbackStorefrontSettings.contact.phone),
      email: preferValue(settings.contact.email, fallbackStorefrontSettings.contact.email),
      hours: preferValue(settings.contact.hours, fallbackStorefrontSettings.contact.hours),
      address: preferValue(settings.contact.address, fallbackStorefrontSettings.contact.address),
      mapUrl: preferValue(settings.contact.mapUrl, fallbackStorefrontSettings.contact.mapUrl),
    },
    socials: settings.socials.length ? visibleSocials : fallbackStorefrontSettings.socials,
  }
}

const hasStringFields = (value: unknown, fields: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return fields.every((field) => typeof record[field] === 'string')
}

export const isStorefrontSettings = (value: unknown): value is StorefrontSettings => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StorefrontSettings>
  if (
    typeof candidate.configured !== 'boolean'
    || !hasStringFields(candidate.identity, ['name', 'avatarUrl', 'legalName', 'taxCode', 'tagline', 'description'])
    || !hasStringFields(candidate.contact, ['phone', 'email', 'hours', 'address', 'mapUrl'])
    || !Array.isArray(candidate.socials)
    || !Number.isInteger(candidate.version)
    || (candidate.updatedAt !== null && typeof candidate.updatedAt !== 'string')
    || (Boolean(candidate.identity?.avatarUrl) && !isHttpsUrl(candidate.identity?.avatarUrl ?? ''))
    || (Boolean(candidate.contact?.mapUrl) && !isHttpsUrl(candidate.contact?.mapUrl ?? ''))
  ) return false

  return candidate.socials.every((social) => (
    Boolean(social)
    && typeof social === 'object'
    && storefrontSocialPlatforms.includes(social.platform)
    && typeof social.label === 'string'
    && typeof social.url === 'string'
    && isHttpsUrl(social.url)
    && typeof social.enabled === 'boolean'
    && Number.isInteger(social.sortOrder)
  ))
}

export const readCachedStorefrontSettings = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null') as unknown
    return isStorefrontSettings(parsed) ? resolveStorefrontSettings(parsed) : null
  } catch {
    return null
  }
}

const cacheStorefrontSettings = (settings: StorefrontSettings) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings))
  } catch {
    // The live value still works when storage is unavailable.
  }
}

export const fetchStorefrontSettings = async () => {
  const response = await axiosClient.fetch('/storefront/settings')
  const result = (await response.json().catch(() => ({}))) as ApiResponse<StorefrontSettings>
  if (!response.ok || !isStorefrontSettings(result.data)) {
    throw new Error(result.message || 'Không thể tải thông tin cửa hàng.')
  }

  cacheStorefrontSettings(result.data)
  return resolveStorefrontSettings(result.data)
}
