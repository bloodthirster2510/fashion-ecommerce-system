import type { Request, Response } from 'express';
import { adminLogin, forgotPassword, refreshToken, sendOtp } from '../auth.controller';
import * as authService from '../auth.service';
import { REFRESH_TOKEN_COOKIE_MODE_HEADER } from '../refresh-token-cookie';
import { SmsDeliveryError } from '../../../utils/sms-provider';

jest.mock('../auth.service', () => ({
  sendOtp: jest.fn(),
  forgotPassword: jest.fn(),
  loginAdminUser: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  send: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    send: jest.fn(),
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.cookie.mockReturnValue(res);
  res.clearCookie.mockReturnValue(res);
  res.send.mockReturnValue(res);

  return res;
};

const createRequest = ({
  body = {},
  cookie,
  cookieMode = true,
}: {
  body?: Record<string, unknown>;
  cookie?: string;
  cookieMode?: boolean;
}) => ({
  body,
  headers: {
    ...(cookie ? { cookie } : {}),
  },
  get: jest.fn((headerName: string) => (
    cookieMode && headerName.toLowerCase() === REFRESH_TOKEN_COOKIE_MODE_HEADER.toLowerCase()
      ? 'cookie'
      : undefined
  )),
}) as unknown as Request;

describe('auth controller refresh cookie mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('sets an httpOnly refresh cookie and omits refreshToken for admin login', async () => {
    (authService.loginAdminUser as jest.Mock).mockResolvedValue({
      accessToken: 'admin_access',
      refreshToken: 'admin_refresh',
      user: {
        _id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
      },
    });
    const res = createResponse();

    await adminLogin(createRequest({
      body: {
        identifier: 'admin@example.com',
        password: 'Password@123',
      },
    }), res);

    expect(res.cookie).toHaveBeenCalledWith(
      'fashion_refresh_token',
      'admin_refresh',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/auth',
        sameSite: 'lax',
        secure: false,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.any(String),
      data: expect.not.objectContaining({ refreshToken: expect.any(String) }),
    });
  });

  it('refreshes from the httpOnly cookie when request body has no refresh token', async () => {
    (authService.refreshAccessToken as jest.Mock).mockResolvedValue({
      accessToken: 'next_access',
      refreshToken: 'next_refresh',
    });
    const res = createResponse();

    await refreshToken(createRequest({
      body: {},
      cookie: 'fashion_refresh_token=old_refresh',
    }), res);

    expect(authService.refreshAccessToken).toHaveBeenCalledWith('old_refresh');
    expect(res.cookie).toHaveBeenCalledWith(
      'fashion_refresh_token',
      'next_refresh',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/auth',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      message: expect.any(String),
      data: {
        accessToken: 'next_access',
      },
    });
  });

  it('does not read refresh cookies when cookie mode header is missing', async () => {
    const res = createResponse();

    await refreshToken(createRequest({
      body: {},
      cookie: 'fashion_refresh_token=old_refresh',
      cookieMode: false,
    }), res);

    expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('auth controller SMS delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('returns mock delivery information when sending a registration OTP', async () => {
    (authService.sendOtp as jest.Mock).mockResolvedValue({
      mode: 'mock',
      provider: 'mock',
      testOtp: '123456',
    });
    const res = createResponse();

    await sendOtp(createRequest({
      body: { phone: '0901234567' },
      cookieMode: false,
    }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.any(String),
      data: {
        mode: 'mock',
        provider: 'mock',
        testOtp: '123456',
      },
    });
  });

  it('returns the provider error contract when password recovery SMS delivery fails', async () => {
    (authService.forgotPassword as jest.Mock).mockRejectedValue(
      new SmsDeliveryError('provider unavailable', {
        status: 502,
        code: 'SMS_PROVIDER_UNAVAILABLE',
        retryable: true,
      }),
    );
    const res = createResponse();

    await forgotPassword(createRequest({
      body: { identifier: '0901234567' },
      cookieMode: false,
    }), res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.any(String),
      errorCode: 'SMS_PROVIDER_UNAVAILABLE',
    });
  });
});
