import { API_BASE_URL } from './api';

export const LEGAL_POLICY_VERSION = '2026-07-13';

const inferredStorefrontUrl = API_BASE_URL
  .replace(/\/api\/?$/, '')
  .replace(/:5000$/, ':5173');
export const STOREFRONT_URL = (
  process.env.EXPO_PUBLIC_STOREFRONT_URL?.trim() || inferredStorefrontUrl
).replace(/\/+$/, '');

export const policyUrls = {
  terms: `${STOREFRONT_URL}/policies/terms`,
  privacy: `${STOREFRONT_URL}/policies/privacy`,
  shipping: `${STOREFRONT_URL}/policies/shipping`,
  returns: `${STOREFRONT_URL}/policies/returns`,
  complaints: `${STOREFRONT_URL}/policies/complaints`,
};
