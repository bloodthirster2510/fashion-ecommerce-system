import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_TOKEN_COOKIE_MODE_HEADER = 'X-Refresh-Token-Mode';

const DEFAULT_REFRESH_TOKEN_COOKIE_NAME = 'fashion_refresh_token';
const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const getRefreshTokenCookieName = () =>
  process.env.REFRESH_TOKEN_COOKIE_NAME?.trim() || DEFAULT_REFRESH_TOKEN_COOKIE_NAME;

const isCookieSecure = () =>
  process.env.REFRESH_TOKEN_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

const getCookieSameSite = (): CookieOptions['sameSite'] => {
  const configured = process.env.REFRESH_TOKEN_COOKIE_SAME_SITE?.trim().toLowerCase();

  if (configured === 'strict' || configured === 'lax' || configured === 'none') {
    return configured;
  }

  return isCookieSecure() ? 'none' : 'lax';
};

const getRefreshTokenCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isCookieSecure(),
  sameSite: getCookieSameSite(),
  path: REFRESH_TOKEN_COOKIE_PATH,
});

const parseCookieHeader = (cookieHeader?: string) => {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((cookiePair) => {
    const separatorIndex = cookiePair.indexOf('=');
    if (separatorIndex <= 0) return;

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();

    if (!name) return;

    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  });

  return cookies;
};

export const isRefreshTokenCookieMode = (req: Request) =>
  req.get(REFRESH_TOKEN_COOKIE_MODE_HEADER)?.trim().toLowerCase() === 'cookie';

export const getRefreshTokenFromCookie = (req: Request) =>
  parseCookieHeader(req.headers.cookie).get(getRefreshTokenCookieName());

export const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie(getRefreshTokenCookieName(), refreshToken, {
    ...getRefreshTokenCookieOptions(),
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

export const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(getRefreshTokenCookieName(), getRefreshTokenCookieOptions());
};

export const applyRefreshTokenCookieMode = <T extends { refreshToken: string }>(
  req: Request,
  res: Response,
  payload: T,
) => {
  if (!isRefreshTokenCookieMode(req)) {
    return payload;
  }

  setRefreshTokenCookie(res, payload.refreshToken);
  const { refreshToken, ...cookiePayload } = payload;
  void refreshToken;
  return cookiePayload;
};
