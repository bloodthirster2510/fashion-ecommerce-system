import type { CorsOptions } from 'cors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import crypto from 'crypto';
import { buildRedisKey, getRedisClient, isRedisEnabled } from '../config/redis';
import { RateLimitBucket as PersistentRateLimitBucket } from '../database/models/rate-limit-bucket.model';

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
const DEFAULT_API_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_API_RATE_LIMIT_MAX = 600;
const DEFAULT_COUPON_VALIDATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_COUPON_VALIDATE_RATE_LIMIT_MAX = 30;
const DEFAULT_REVIEW_CREATE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_REVIEW_CREATE_RATE_LIMIT_MAX = 5;
const DEFAULT_REVIEW_MUTATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_REVIEW_MUTATION_RATE_LIMIT_MAX = 20;
const DEFAULT_REVIEW_HELPFUL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_REVIEW_HELPFUL_RATE_LIMIT_MAX = 60;

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
    'Idempotency-Key',
    'X-Session-Id',
    'X-Refresh-Token-Mode',
    'X-GHN-Webhook-Secret',
    'X-Shipping-Webhook-Secret',
  ],
  exposedHeaders: [
    'Content-Disposition',
    'X-Export-Total',
    'X-Export-Truncated',
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
  // req.ip honors X-Forwarded-For only through Express's configured trust proxy policy.
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const completeRateLimit = (
  res: Response,
  next: NextFunction,
  bucket: RateLimitBucket,
  max: number,
  currentTime: number,
) => {
  res.setHeader('RateLimit-Limit', String(max));
  res.setHeader('RateLimit-Remaining', String(Math.max(max - bucket.count, 0)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > max) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))));
    res.status(429).json({ message: 'Too many requests. Please try again later.' });
    return;
  }
  next();
};

const createMemoryRateLimitMiddleware = ({
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

    completeRateLimit(res, next, bucket, max, currentTime);
  };
};

const REDIS_RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

const createRedisRateLimitMiddleware = ({
  windowMs,
  max,
  keyPrefix = 'rate-limit',
  now = Date.now,
  keyGenerator,
}: RateLimitOptions): RequestHandler => async (req, res, next) => {
  const currentTime = now();
  const rawKey = keyGenerator?.(req) ?? `${req.method}:${req.originalUrl}:${getClientIp(req)}`;
  const digest = crypto.createHash('sha256').update(rawKey).digest('hex');
  const key = buildRedisKey('rate-limit', `${keyPrefix}:${digest}`);

  try {
    const redisClient = getRedisClient();
    if (!redisClient) throw new Error('Redis is unavailable');

    const result = await redisClient.eval(REDIS_RATE_LIMIT_SCRIPT, {
      keys: [key],
      arguments: [String(windowMs)],
    });
    if (!Array.isArray(result) || result.length < 2) {
      throw new Error('Redis returned an invalid rate-limit result');
    }

    const count = Number(result[0]);
    const ttlMs = Number(result[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
      throw new Error('Redis returned invalid rate-limit values');
    }

    completeRateLimit(res, next, {
      count,
      resetAt: currentTime + Math.max(ttlMs, 1),
    }, max, currentTime);
  } catch (error) {
    console.error('Redis rate limiter failed:', error instanceof Error ? error.message : String(error));
    res.status(503).json({ message: 'Service temporarily unavailable' });
  }
};

const createPersistentRateLimitMiddleware = ({
  windowMs,
  max,
  keyPrefix = 'rate-limit',
  keyGenerator,
}: RateLimitOptions): RequestHandler => async (req, res, next) => {
  const currentTime = Date.now();
  const rawKey = keyGenerator?.(req) ?? `${req.method}:${req.originalUrl}:${getClientIp(req)}`;
  const key = `${keyPrefix}:${crypto.createHash('sha256').update(rawKey).digest('hex')}`;
  const now = new Date(currentTime);
  const nextResetAt = new Date(currentTime + windowMs);

  try {
    const updateBucket = () => PersistentRateLimitBucket.findOneAndUpdate(
        { key },
        [{
          $set: {
            count: {
              $cond: [
                { $gt: ['$resetAt', now] },
                { $add: [{ $ifNull: ['$count', 0] }, 1] },
                1,
              ],
            },
            resetAt: { $cond: [{ $gt: ['$resetAt', now] }, '$resetAt', nextResetAt] },
          },
        }],
        { upsert: true, returnDocument: 'after' },
      ).lean<{ count: number; resetAt: Date }>();

    let bucket;
    try {
      bucket = await updateBucket();
    } catch (error) {
      const duplicateInsert = typeof error === 'object' && error !== null && 'code' in error
        && (error as { code?: number }).code === 11000;
      if (!duplicateInsert) throw error;
      bucket = await updateBucket();
    }

    if (!bucket) throw new Error('Rate limit bucket was not persisted');
    completeRateLimit(res, next, {
      count: bucket.count,
      resetAt: new Date(bucket.resetAt).getTime(),
    }, max, currentTime);
  } catch (error) {
    console.error('Persistent rate limiter failed:', error instanceof Error ? error.message : String(error));
    res.status(503).json({ message: 'Service temporarily unavailable' });
  }
};

const configuredRateLimiter = (options: RateLimitOptions, env: Env) => {
  const configuredStore = env.RATE_LIMIT_STORE?.trim().toLowerCase();
  if (configuredStore === 'redis' && isRedisEnabled(env)) {
    return createRedisRateLimitMiddleware(options);
  }
  if (configuredStore === 'redis') {
    return env.NODE_ENV === 'production'
      ? createPersistentRateLimitMiddleware(options)
      : createMemoryRateLimitMiddleware(options);
  }
  if (configuredStore === 'mongo' || (env.NODE_ENV === 'production' && configuredStore !== 'memory')) {
    return createPersistentRateLimitMiddleware(options);
  }
  return createMemoryRateLimitMiddleware(options);
};

export const createRateLimitMiddleware = (
  options: RateLimitOptions,
  env: Env = process.env,
) => configuredRateLimiter(options, env);

export const createAuthRateLimitMiddleware = (env: Env = process.env) =>
  configuredRateLimiter({
    windowMs: parsePositiveInteger(env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_AUTH_RATE_LIMIT_WINDOW_MS),
    max: parsePositiveInteger(env.AUTH_RATE_LIMIT_MAX, DEFAULT_AUTH_RATE_LIMIT_MAX),
    keyPrefix: 'auth',
  }, env);

export const createApiRateLimitMiddleware = (env: Env = process.env) =>
  configuredRateLimiter({
    windowMs: parsePositiveInteger(env.API_RATE_LIMIT_WINDOW_MS, DEFAULT_API_RATE_LIMIT_WINDOW_MS),
    max: parsePositiveInteger(env.API_RATE_LIMIT_MAX, DEFAULT_API_RATE_LIMIT_MAX),
    keyPrefix: 'api',
    keyGenerator: (req) => `api:${getClientIp(req)}`,
  }, env);

export const createCouponValidateRateLimitMiddleware = (env: Env = process.env) =>
  configuredRateLimiter({
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
  }, env);

const getAuthenticatedClientKey = (req: Request) => req.user?.userId ?? getClientIp(req);

export const createReviewCreateRateLimitMiddleware = (env: Env = process.env) =>
  configuredRateLimiter({
    windowMs: parsePositiveInteger(
      env.REVIEW_CREATE_RATE_LIMIT_WINDOW_MS,
      DEFAULT_REVIEW_CREATE_RATE_LIMIT_WINDOW_MS,
    ),
    max: parsePositiveInteger(env.REVIEW_CREATE_RATE_LIMIT_MAX, DEFAULT_REVIEW_CREATE_RATE_LIMIT_MAX),
    keyPrefix: 'review-create',
    keyGenerator: (req) => `review-create:${getAuthenticatedClientKey(req)}`,
  }, env);

export const createReviewMutationRateLimitMiddleware = (env: Env = process.env) =>
  configuredRateLimiter({
    windowMs: parsePositiveInteger(
      env.REVIEW_MUTATION_RATE_LIMIT_WINDOW_MS,
      DEFAULT_REVIEW_MUTATION_RATE_LIMIT_WINDOW_MS,
    ),
    max: parsePositiveInteger(
      env.REVIEW_MUTATION_RATE_LIMIT_MAX,
      DEFAULT_REVIEW_MUTATION_RATE_LIMIT_MAX,
    ),
    keyPrefix: 'review-mutation',
    keyGenerator: (req) => `review-mutation:${getAuthenticatedClientKey(req)}`,
  }, env);

export const createReviewHelpfulRateLimitMiddleware = (env: Env = process.env) =>
  configuredRateLimiter({
    windowMs: parsePositiveInteger(
      env.REVIEW_HELPFUL_RATE_LIMIT_WINDOW_MS,
      DEFAULT_REVIEW_HELPFUL_RATE_LIMIT_WINDOW_MS,
    ),
    max: parsePositiveInteger(env.REVIEW_HELPFUL_RATE_LIMIT_MAX, DEFAULT_REVIEW_HELPFUL_RATE_LIMIT_MAX),
    keyPrefix: 'review-helpful',
    keyGenerator: (req) => `review-helpful:${getAuthenticatedClientKey(req)}`,
  }, env);
