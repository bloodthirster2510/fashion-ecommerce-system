import type { NextFunction, Request, Response } from 'express';
import {
  createApiRateLimitMiddleware,
  createCouponValidateRateLimitMiddleware,
  createRateLimitMiddleware,
  createReviewCreateRateLimitMiddleware,
  createSecurityHeadersMiddleware,
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
} from '../security.middleware';
import { RateLimitBucket } from '../../database/models/rate-limit-bucket.model';

type MockResponse = Response & {
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
};

const createMockResponse = () => {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

const createMockRequest = (ip = '203.0.113.10') =>
  ({
    headers: {},
    ip,
    method: 'POST',
    originalUrl: '/api/auth/login',
    socket: {},
  }) as Request;

const createAuthenticatedRequest = (userId: string, ip = '203.0.113.10') =>
  ({
    ...createMockRequest(ip),
    originalUrl: '/api/coupons/validate',
    user: {
      userId,
      email: `${userId}@example.com`,
      role: 'user',
    },
  }) as Request;

describe('security middleware', () => {
  describe('CORS origin policy', () => {
    it('uses configured origins and related frontend env values', () => {
      const origins = getAllowedCorsOrigins({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://shop.example.com, https://admin.example.com',
        FRONTEND_URL: 'https://customer.example.com',
      });

      expect(origins).toEqual([
        'https://shop.example.com',
        'https://admin.example.com',
        'https://customer.example.com',
      ]);
    });

    it('blocks unknown browser origins in production', () => {
      const env = {
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://shop.example.com',
      };

      expect(isCorsOriginAllowed('https://shop.example.com', env)).toBe(true);
      expect(isCorsOriginAllowed('https://evil.example.com', env)).toBe(false);
    });

    it('allows local development browser origins without opening production CORS', () => {
      expect(isCorsOriginAllowed('http://localhost:4444', { NODE_ENV: 'development' })).toBe(true);
      expect(isCorsOriginAllowed('http://192.168.1.42:8081', { NODE_ENV: 'development' })).toBe(true);
      expect(isCorsOriginAllowed('https://evil.example.com', { NODE_ENV: 'development' })).toBe(false);
    });
  });

  it('sets API hardening headers', () => {
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    createSecurityHeadersMiddleware()({} as Request, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rate limits repeated requests per client and route', () => {
    let currentTime = 1_000;
    const limiter = createRateLimitMiddleware({
      windowMs: 1_000,
      max: 2,
      keyPrefix: 'test',
      now: () => currentTime,
    });

    const firstNext: NextFunction = jest.fn();
    limiter(createMockRequest(), createMockResponse(), firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const secondNext: NextFunction = jest.fn();
    limiter(createMockRequest(), createMockResponse(), secondNext);
    expect(secondNext).toHaveBeenCalledTimes(1);

    const blockedRes = createMockResponse();
    const blockedNext: NextFunction = jest.fn();
    limiter(createMockRequest(), blockedRes, blockedNext);

    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      message: 'Too many requests. Please try again later.',
    });
    expect(blockedRes.setHeader).toHaveBeenCalledWith('Retry-After', '1');

    currentTime = 2_001;
    const afterWindowNext: NextFunction = jest.fn();
    limiter(createMockRequest(), createMockResponse(), afterWindowNext);
    expect(afterWindowNext).toHaveBeenCalledTimes(1);
  });

  it('rate limits coupon validation per authenticated user', () => {
    const limiter = createCouponValidateRateLimitMiddleware({
      COUPON_VALIDATE_RATE_LIMIT_WINDOW_MS: '1000',
      COUPON_VALIDATE_RATE_LIMIT_MAX: '1',
    });

    const firstNext: NextFunction = jest.fn();
    limiter(createAuthenticatedRequest('user-1'), createMockResponse(), firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const blockedRes = createMockResponse();
    const blockedNext: NextFunction = jest.fn();
    limiter(createAuthenticatedRequest('user-1', '203.0.113.99'), blockedRes, blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedRes.status).toHaveBeenCalledWith(429);

    const otherUserNext: NextFunction = jest.fn();
    limiter(createAuthenticatedRequest('user-2'), createMockResponse(), otherUserNext);
    expect(otherUserNext).toHaveBeenCalledTimes(1);
  });

  it('rate limits review creation per authenticated user across IP addresses', () => {
    const limiter = createReviewCreateRateLimitMiddleware({
      REVIEW_CREATE_RATE_LIMIT_WINDOW_MS: '1000',
      REVIEW_CREATE_RATE_LIMIT_MAX: '1',
    });
    const firstRequest = createAuthenticatedRequest('review-user', '203.0.113.10');
    firstRequest.originalUrl = '/api/reviews';
    const firstNext: NextFunction = jest.fn();
    limiter(firstRequest, createMockResponse(), firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const blockedRequest = createAuthenticatedRequest('review-user', '203.0.113.11');
    blockedRequest.originalUrl = '/api/reviews';
    const blockedResponse = createMockResponse();
    limiter(blockedRequest, blockedResponse, jest.fn());
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });

  it('rate limits API requests per client across routes', () => {
    const limiter = createApiRateLimitMiddleware({
      API_RATE_LIMIT_WINDOW_MS: '1000',
      API_RATE_LIMIT_MAX: '2',
    });
    const firstRequest = createMockRequest('203.0.113.10');
    firstRequest.originalUrl = '/api/products';
    const secondRequest = createMockRequest('203.0.113.10');
    secondRequest.originalUrl = '/api/orders';
    const blockedRequest = createMockRequest('203.0.113.10');
    blockedRequest.originalUrl = '/api/cart';

    const firstNext: NextFunction = jest.fn();
    limiter(firstRequest, createMockResponse(), firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const secondNext: NextFunction = jest.fn();
    limiter(secondRequest, createMockResponse(), secondNext);
    expect(secondNext).toHaveBeenCalledTimes(1);

    const blockedRes = createMockResponse();
    const blockedNext: NextFunction = jest.fn();
    limiter(blockedRequest, blockedRes, blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedRes.status).toHaveBeenCalledWith(429);

    const otherClientNext: NextFunction = jest.fn();
    limiter(createMockRequest('203.0.113.11'), createMockResponse(), otherClientNext);
    expect(otherClientNext).toHaveBeenCalledTimes(1);
  });

  it('does not trust a client-supplied forwarded IP without trusted proxy configuration', () => {
    const limiter = createRateLimitMiddleware({ windowMs: 1_000, max: 1 });
    const firstRequest = createMockRequest('203.0.113.10');
    firstRequest.headers['x-forwarded-for'] = '198.51.100.1';
    limiter(firstRequest, createMockResponse(), jest.fn());

    const secondRequest = createMockRequest('203.0.113.10');
    secondRequest.headers['x-forwarded-for'] = '198.51.100.2';
    const response = createMockResponse();
    limiter(secondRequest, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(429);
  });

  it('uses the shared MongoDB rate-limit store in production', async () => {
    const lean = jest.fn().mockResolvedValue({ count: 1, resetAt: new Date(Date.now() + 1_000) });
    const findOneAndUpdate = jest.spyOn(RateLimitBucket, 'findOneAndUpdate')
      .mockReturnValue({ lean } as never);
    const limiter = createApiRateLimitMiddleware({
      NODE_ENV: 'production',
      API_RATE_LIMIT_WINDOW_MS: '1000',
      API_RATE_LIMIT_MAX: '2',
    });
    const next: NextFunction = jest.fn();

    await limiter(createMockRequest(), createMockResponse(), next);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
