import type { CorsOptions } from 'cors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
];

const DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_AUTH_RATE_LIMIT_MAX = 60;
const DEFAULT_COUPON_VALIDATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_COUPON_VALIDATE_RATE_LIMIT_MAX = 30;

const parseCsv = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

const isProduction = (env: Env) => env.NODE_ENV === 'production';

const isLocalDevelopmentOrigin = (origin: string) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const { hostname } = new URL(normalizedOrigin);
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
    return true;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  const private172 = hostname.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
};

export const getAllowedCorsOrigins = (env: Env = process.env) => {
  const configuredOrigins = [
    ...parseCsv(env.CORS_ORIGINS),
    ...parseCsv(env.FRONTEND_URL),
    ...parseCsv(env.ADMIN_FRONTEND_URL),
    ...parseCsv(env.CUSTOMER_FRONTEND_URL),
  ];

  return configuredOrigins.length > 0 || isProduction(env)
    ? configuredOrigins
    : DEFAULT_DEV_CORS_ORIGINS;
};

export const isCorsOriginAllowed = (origin: string, env: Env = process.env) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const allowedOrigins = getAllowedCorsOrigins(env)
    .map(normalizeOrigin)
    .filter((item): item is string => Boolean(item));

  if (allowedOrigins.includes(normalizedOrigin)) return true;
  return !isProduction(env) && isLocalDevelopmentOrigin(normalizedOrigin);
};

export const createCorsOptions = (env: Env = process.env): CorsOptions => ({
  origin(origin, callback) {
    if (!origin || isCorsOriginAllowed(origin, env)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-GHN-Webhook-Secret',
    'X-Shipping-Webhook-Secret',
  ],
  maxAge: 600,
  optionsSuccessStatus: 204,
});

export const createSecurityHeadersMiddleware = (): RequestHandler => {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  };
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  now?: () => number;
  keyGenerator?: (req: Request) => string;
};

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const createRateLimitMiddleware = ({
  windowMs,
  max,
  keyPrefix = 'rate-limit',
  now = Date.now,
  keyGenerator,
}: RateLimitOptions): RequestHandler => {
  const buckets = new Map<string, RateLimitBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const currentTime = now();
    const key = keyGenerator?.(req) ?? `${keyPrefix}:${req.method}:${req.originalUrl}:${getClientIp(req)}`;
    const existingBucket = buckets.get(key);
    const bucket =
      existingBucket && existingBucket.resetAt > currentTime
        ? existingBucket
        : { count: 0, resetAt: currentTime + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (buckets.size > 1000) {
      for (const [bucketKey, value] of buckets.entries()) {
        if (value.resetAt <= currentTime) buckets.delete(bucketKey);
      }
    }

    const remaining = Math.max(max - bucket.count, 0);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - currentTime) / 1000)));
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
      return;
    }

    next();
  };
};

export const createAuthRateLimitMiddleware = (env: Env = process.env) =>
  createRateLimitMiddleware({
    windowMs: parsePositiveInteger(env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS),
    max: parsePositiveInteger(env.AUTH_RATE_LIMIT_MAX, DEFAULT_AUTH_RATE_LIMIT_MAX),
    keyPrefix: 'auth',
  });

export const createCouponValidateRateLimitMiddleware = (env: Env = process.env) =>
  createRateLimitMiddleware({
    windowMs: parsePositiveInteger(
      env.COUPON_VALIDATE_RATE_LIMIT_WINDOW_MS,
      DEFAULT_COUPON_VALIDATE_RATE_LIMIT_WINDOW_MS,
    ),
    max: parsePositiveInteger(env.COUPON_VALIDATE_RATE_LIMIT_MAX, DEFAULT_COUPON_VALIDATE_RATE_LIMIT_MAX),
    keyPrefix: 'coupon-validate',
    keyGenerator: (req) => {
      const clientKey = req.user?.userId ?? getClientIp(req);
      return `coupon-validate:${clientKey}`;
    },
  });
