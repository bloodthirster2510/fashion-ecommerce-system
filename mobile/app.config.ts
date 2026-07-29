import type { ConfigContext, ExpoConfig } from 'expo/config';

const normalizeSchemes = (scheme: ExpoConfig['scheme']) => {
  if (Array.isArray(scheme)) return scheme;
  return scheme ? [scheme] : [];
};

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!config.name || !config.slug) {
    throw new Error('Expo app name and slug must be defined in app.json');
  }

  const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() ?? '';
  const facebookScheme = /^\d{5,}$/.test(facebookAppId) ? `fb${facebookAppId}` : '';
  const scheme = Array.from(new Set([
    ...normalizeSchemes(config.scheme),
    ...(facebookScheme ? [facebookScheme] : []),
  ]));

  return {
    ...config,
    name: config.name,
    slug: config.slug,
    scheme,
  };
};
