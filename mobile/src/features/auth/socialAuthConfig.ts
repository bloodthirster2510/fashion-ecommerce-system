import { Platform, type PlatformOSType } from 'react-native';

const GOOGLE_CLIENT_ID_PATTERN = /^[a-z0-9._-]+\.apps\.googleusercontent\.com$/i;
const FACEBOOK_APP_ID_PATTERN = /^\d{5,}$/;
const NATIVE_APPLICATION_ID = 'com.fashionshop.app';

export type SocialAuthEnvironment = {
  mode?: string;
  googleClientId?: string;
  facebookAppId?: string;
};

type SocialProviderConfig = {
  enabled: boolean;
  clientId: string;
  redirectUri?: string;
};

export type SocialAuthConfig = {
  mode: 'auto' | 'disabled';
  google: SocialProviderConfig;
  facebook: SocialProviderConfig;
  enabled: boolean;
};

const bundledEnvironment: SocialAuthEnvironment = {
  mode: process.env.EXPO_PUBLIC_SOCIAL_AUTH_MODE,
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  facebookAppId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
};

const normalize = (value?: string) => value?.trim() ?? '';

export const resolveSocialAuthConfig = (
  environment: SocialAuthEnvironment = bundledEnvironment,
  platform: PlatformOSType = Platform.OS,
): SocialAuthConfig => {
  const mode = normalize(environment.mode).toLowerCase() === 'disabled' ? 'disabled' : 'auto';
  const googleClientId = normalize(environment.googleClientId);
  const facebookAppId = normalize(environment.facebookAppId);
  const googleEnabled = mode === 'auto' && GOOGLE_CLIENT_ID_PATTERN.test(googleClientId);
  const facebookEnabled = mode === 'auto' && FACEBOOK_APP_ID_PATTERN.test(facebookAppId);
  const native = platform !== 'web';

  return {
    mode,
    google: {
      enabled: googleEnabled,
      clientId: googleClientId,
      ...(native ? { redirectUri: `${NATIVE_APPLICATION_ID}:/oauthredirect` } : {}),
    },
    facebook: {
      enabled: facebookEnabled,
      clientId: facebookAppId,
      ...(native && facebookEnabled ? { redirectUri: `fb${facebookAppId}://authorize` } : {}),
    },
    enabled: googleEnabled || facebookEnabled,
  };
};

export const socialAuthConfig = resolveSocialAuthConfig();
