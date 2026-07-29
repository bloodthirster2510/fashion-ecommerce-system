export type PasswordResetLinkPayload = {
  identifier: string;
  token: string;
};

export const getUrlParam = (url: string, key: string) => {
  const match = url.match(new RegExp(`[?&]${key}=([^&]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    return null;
  }
};

export const parsePasswordResetLink = (url: string): PasswordResetLinkPayload | null => {
  if (!url.includes('reset-password')) return null;
  const identifier = getUrlParam(url, 'identifier')?.trim();
  const token = getUrlParam(url, 'token')?.trim();
  return identifier && token ? { identifier, token } : null;
};
