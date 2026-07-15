export const storefrontSocialPlatforms = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'zalo',
  'other',
] as const;

export type StorefrontSocialPlatform = typeof storefrontSocialPlatforms[number];

export type StorefrontSettings = {
  configured: boolean;
  identity: {
    name: string;
    avatarUrl: string;
    legalName: string;
    taxCode: string;
    tagline: string;
    description: string;
  };
  contact: {
    phone: string;
    email: string;
    hours: string;
    address: string;
    mapUrl: string;
  };
  socials: Array<{
    platform: StorefrontSocialPlatform;
    label: string;
    url: string;
    enabled: boolean;
    sortOrder: number;
  }>;
  version: number;
  updatedAt: string | null;
};
