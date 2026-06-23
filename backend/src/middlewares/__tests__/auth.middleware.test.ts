import type { NextFunction, Request, Response } from 'express';
import { User } from '../../database/models/user.model';
import { requireActiveAccount } from '../auth.middleware';

jest.mock('../../database/models/user.model', () => ({
  User: {
    findById: jest.fn(),
  },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const createResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (response.status as jest.Mock).mockReturnValue(response);
  (response.json as jest.Mock).mockReturnValue(response);
  return response;
};

const mockAccount = (account: { role: string; isActive: boolean } | null) => {
  // Mock chain User.findById(...).select(...).lean(...) giống middleware dùng thật.
  mockedUser.findById.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(account),
  } as never);
};

describe('requireActiveAccount', () => {
  const request = {
    user: { userId: '665000000000000000000001', email: 'user@example.com', role: 'user' },
  } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an active account whose current role matches the token', async () => {
    mockAccount({ role: 'user', isActive: true });
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    await requireActiveAccount(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects an inactive account even when its access token is still valid', async () => {
    mockAccount({ role: 'user', isActive: false });
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    await requireActiveAccount(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a stale token after the account role changes', async () => {
    // Token vẫn hợp lệ về chữ ký nhưng role trong DB đã đổi nên phải bị từ chối.
    mockAccount({ role: 'staff', isActive: true });
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    await requireActiveAccount(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
