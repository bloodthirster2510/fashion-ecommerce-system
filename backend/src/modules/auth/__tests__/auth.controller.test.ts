import type { Request, Response } from 'express';
import { adminLogin, forgotPassword, login, logout, refreshToken, sendOtp } from '../auth.controller';
import * as authService from '../auth.service';
import { REFRESH_TOKEN_COOKIE_MODE_HEADER } from '../refresh-token-cookie';
import { SmsDeliveryError } from '../../../utils/sms-provider';
import { EmailDeliveryError } from '../../../utils/email-provider';
import { LoginSecurityError } from '../login-security.service';

jest.mock('../auth.service', () => ({
  sendOtp: jest.fn(),
  forgotPassword: jest.fn(),
  loginAdminUser: jest.fn(),
  loginUser: jest.fn(),
  logoutWithAccessToken: jest.fn(),
  logoutWithRefreshToken: jest.fn(),
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
  accessToken,
}: {
  body?: Record<string, unknown>;
  cookie?: string;
  cookieMode?: boolean;
  accessToken?: string;
}) => ({
  body,
  headers: {
    ...(cookie ? { cookie } : {}),
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
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

describe('auth controller logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('falls back to the refresh token when the access token has expired', async () => {
    (authService.logoutWithAccessToken as jest.Mock).mockRejectedValue(
      new Error('expired access token'),
    );
    (authService.logoutWithRefreshToken as jest.Mock).mockResolvedValue(undefined);
    const res = createResponse();

    await logout(createRequest({
      body: { refreshToken: 'valid_refresh' },
      accessToken: 'expired_access',
      cookieMode: false,
    }), res);

    expect(authService.logoutWithAccessToken).toHaveBeenCalledWith('expired_access');
    expect(authService.logoutWithRefreshToken).toHaveBeenCalledWith('valid_refresh');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('auth controller login lock response', () => {
  it('returns the structured lock contract and Retry-After header', async () => {
    (authService.loginUser as jest.Mock).mockRejectedValue(new LoginSecurityError(
      'Tài khoản tạm khóa',
      {
        status: 429,
        errorCode: 'LOGIN_TEMPORARILY_LOCKED',
        data: {
          lockedUntil: '2030-01-01T00:00:00.000Z',
          retryAfterSeconds: 900,
          canUnlock: true,
        },
      },
    ));
    const res = createResponse();
    res.setHeader = jest.fn() as never;

    await login(createRequest({
      body: { identifier: 'customer@example.com', password: 'wrong-password' },
      cookieMode: false,
    }), res);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '900');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Tài khoản tạm khóa',
      errorCode: 'LOGIN_TEMPORARILY_LOCKED',
      data: {
        lockedUntil: '2030-01-01T00:00:00.000Z',
        retryAfterSeconds: 900,
        canUnlock: true,
      },
    });
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

  it('returns the provider error contract when password recovery email delivery fails', async () => {
    (authService.forgotPassword as jest.Mock).mockRejectedValue(
      new EmailDeliveryError('provider unavailable', {
        status: 502,
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
      }),
    );
    const res = createResponse();

    await forgotPassword(createRequest({
      body: { identifier: 'customer@example.com' },
      cookieMode: false,
    }), res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.any(String),
      errorCode: 'EMAIL_PROVIDER_UNAVAILABLE',
    });
  });
});
