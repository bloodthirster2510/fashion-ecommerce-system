export const storefrontSocialPlatforms = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'zalo',
  'other',
] as const

export type StorefrontSocialPlatform = typeof storefrontSocialPlatforms[number]

export type StorefrontIdentity = {
  name: string
  legalName: string
  taxCode: string
  tagline: string
  description: string
}

export type StorefrontContact = {
  phone: string
  email: string
  hours: string
  address: string
  mapUrl: string
}

export type StorefrontSocialLink = {
  platform: StorefrontSocialPlatform
  label: string
  url: string
  enabled: boolean
  sortOrder: number
}

export type StorefrontSettings = {
  configured: boolean
  identity: StorefrontIdentity
  contact: StorefrontContact
  socials: StorefrontSocialLink[]
  version: number
  updatedAt: string | null
}

export type StorefrontSettingsUpdate = Pick<
  StorefrontSettings,
  'identity' | 'contact' | 'socials' | 'version'
>
