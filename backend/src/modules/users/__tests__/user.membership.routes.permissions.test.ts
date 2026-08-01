import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { User } from '../../../database/models/user.model';
import { generateAccessToken } from '../../../utils/jwt';
import { customerUserRouter } from '../user.routes';
import { getUserMembership } from '../membership.service';

jest.mock('../user.controller', () => {
  const ok = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => (
    res.status(204).end()
  );
  return {
    addAddress: ok,
    deleteAddress: ok,
    forcePasswordReset: ok,
    getAddresses: ok,
    getCustomerSummary: ok,
    getMe: ok,
    getUserById: ok,
    getUsers: ok,
    setDefaultAddress: ok,
    updateAddress: ok,
    updateMe: ok,
    updateUserRole: ok,
    updateUserStatus: ok,
    uploadAvatar: ok,
  };
});

jest.mock('../customer-insight.controller', () => {
  const ok = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => (
    res.status(204).end()
  );
  return {
    createCustomerNote: ok,
    deleteCustomerNote: ok,
    getCustomerInsights: ok,
    listCustomerNotes: ok,
    updateCustomerNote: ok,
  };
});

jest.mock('../membership.service', () => ({
  getUserMembership: jest.fn(),
}));

jest.mock('../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;
const mockedGetUserMembership = getUserMembership as jest.MockedFunction<typeof getUserMembership>;

const mockAccount = (role: 'user' | 'admin', isActive: boolean) => {
  mockedUser.findById.mockReturnValue({
    select: jest.fn((fields: string) => {
      if (fields === 'loyaltyPoint') return Promise.resolve({ loyaltyPoint: 1200 });
      return {
        lean: jest.fn().mockResolvedValue(fields.includes('role')
          ? { role, isActive }
          : { mustChangePassword: false, passwordChangedAt: null }),
      };
    }),
  } as never);
};

describe('mobile membership route account state', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use('/users', customerUserRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/users/me/membership`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetUserMembership.mockResolvedValue({
      currentTier: null,
      nextTier: null,
      loyaltyPoint: 1200,
      pointToNextTier: null,
      progressPercent: 0,
      tiers: [],
    });
  });

  const request = (role: 'user' | 'admin') => {
    const token = generateAccessToken({
      userId: '665000000000000000000002',
      email: `${role}@example.com`,
      role,
    });
    return fetch(baseUrl, { headers: { Authorization: `Bearer ${token}` } });
  };

  it('serves membership data to an active mobile user', async () => {
    mockAccount('user', true);
    await expect(request('user')).resolves.toMatchObject({ status: 200 });
    expect(mockedGetUserMembership).toHaveBeenCalledWith('665000000000000000000002', 1200);
  });

  it('blocks a disabled mobile user even when its token is still valid', async () => {
    mockAccount('user', false);
    await expect(request('user')).resolves.toMatchObject({ status: 403 });
    expect(mockedGetUserMembership).not.toHaveBeenCalled();
  });

  it('rejects admin tokens on the customer membership endpoint', async () => {
    mockAccount('admin', true);
    await expect(request('admin')).resolves.toMatchObject({ status: 403 });
    expect(mockedGetUserMembership).not.toHaveBeenCalled();
  });
});
