import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { User } from '../../../../database/models/user.model';
import { generateAccessToken } from '../../../../utils/jwt';
import membershipRankingAdminRouter from '../membership-ranking.routes';

jest.mock('../membership-ranking.controller', () => {
  const ok = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => (
    res.status(204).end()
  );
  return {
    adjustLoyaltyPoints: ok,
    createMembershipRanking: ok,
    createMembershipRankingsBatch: ok,
    deleteMembershipRanking: ok,
    listLoyaltyPointHistory: ok,
    listLoyaltyUsers: ok,
    listMembershipRankings: ok,
    reorderMembershipRankings: ok,
    updateMembershipRanking: ok,
    updateMembershipRankingStatus: ok,
  };
});

jest.mock('../loyalty-rule.controller', () => {
  const ok = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => (
    res.status(204).end()
  );
  return {
    createLoyaltyRule: ok,
    deleteLoyaltyRule: ok,
    listLoyaltyRules: ok,
    updateLoyaltyRule: ok,
  };
});

jest.mock('../../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const mockAdminAccount = (isActive: boolean) => {
  mockedUser.findById.mockReturnValue({
    select: jest.fn((fields: string) => ({
      lean: jest.fn().mockResolvedValue(fields.includes('role')
        ? { role: 'admin', isActive }
        : { mustChangePassword: false, passwordChangedAt: null }),
    })),
  } as never);
};

describe('admin loyalty route account state', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/admin/membership-rankings', membershipRankingAdminRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/admin/membership-rankings`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => jest.clearAllMocks());

  const request = () => {
    const token = generateAccessToken({
      userId: '665000000000000000000001',
      email: 'admin@example.com',
      role: 'admin',
    });
    return fetch(baseUrl, { headers: { Authorization: `Bearer ${token}` } });
  };

  it('allows an active admin account', async () => {
    mockAdminAccount(true);
    await expect(request()).resolves.toMatchObject({ status: 204 });
  });

  it('blocks a disabled admin account even when its token is still valid', async () => {
    mockAdminAccount(false);
    await expect(request()).resolves.toMatchObject({ status: 403 });
  });
});
