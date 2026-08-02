import type { NextFunction, Request, Response } from 'express';
import { User } from '../../database/models/user.model';
import { verifyAccessToken } from '../../utils/jwt';
import { authenticate, requireActiveAccount } from '../auth.middleware';

jest.mock('../../database/models/user.model');
jest.mock('../../utils/jwt', () => ({
  ...jest.requireActual('../../utils/jwt'),
  verifyAccessToken: jest.fn(),
}));

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const createRequest = (path = '/orders', baseUrl = '/api/orders') => ({
  headers: { authorization: 'Bearer access-token' },
  path,
  baseUrl,
}) as unknown as Request;

const mockAccountState = (state: {
  mustChangePassword?: boolean;
  passwordChangedAt?: Date | null;
}) => {
  (User.findById as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(state),
    }),
  });
};

describe('auth middleware token state', () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'user-1',
      email: 'customer@example.com',
      role: 'user',
      iat: 1_700_000_000,
    });
  });

  it('rejects an access token issued before a forced password reset', async () => {
    mockAccountState({
      mustChangePassword: true,
      passwordChangedAt: new Date(1_700_000_100 * 1000),
    });
    const res = createResponse();

    await authenticate(createRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access token has been revoked' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token changed later within the same second', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'user-1',
      email: 'customer@example.com',
      role: 'user',
      iat: 1_700_000_000,
      issuedAtMs: 1_700_000_000_100,
    });
    mockAccountState({
      mustChangePassword: false,
      passwordChangedAt: new Date(1_700_000_000_900),
    });
    const res = createResponse();

    await authenticate(createRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks normal APIs for a newly authenticated account that must change password', async () => {
    mockAccountState({
      mustChangePassword: true,
      passwordChangedAt: new Date(1_699_999_999 * 1000),
    });
    const res = createResponse();

    await authenticate(createRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password change is required',
      errorCode: 'MUST_CHANGE_PASSWORD',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows the authenticated password change route', async () => {
    mockAccountState({
      mustChangePassword: true,
      passwordChangedAt: new Date(1_699_999_999 * 1000),
    });
    const req = createRequest('/change-password', '/api/auth');
    const res = createResponse();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ userId: 'user-1' });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireActiveAccount', () => {
  const request = {
    user: { userId: '665000000000000000000001', email: 'user@example.com', role: 'user' },
  } as unknown as Request;

  const mockActiveAccount = (account: { role: string; isActive: boolean } | null) => {
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(account),
      }),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an active account whose current role matches the token', async () => {
    mockActiveAccount({ role: 'user', isActive: true });
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    await requireActiveAccount(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects an inactive account even when its access token is still valid', async () => {
    mockActiveAccount({ role: 'user', isActive: false });
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    await requireActiveAccount(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a stale token after the account role changes', async () => {
    mockActiveAccount({ role: 'staff', isActive: true });
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    await requireActiveAccount(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
