import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { User } from '../../../database/models/user.model';
import { generateAccessToken } from '../../../utils/jwt';
import adminRecommendationRouter from '../recommendation.admin.route';
import recommendationRouter from '../recommendation.route';

jest.mock('../recommendation.controller', () => {
  const noContent = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => (
    res.status(204).end()
  );
  return {
    createRecommendationEvent: noContent,
    getCartRecommendations: noContent,
    getMyRecommendations: noContent,
    getRecommendationAnalytics: noContent,
    getSimilarProducts: noContent,
    previewRecommendations: noContent,
  };
});

jest.mock('../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const mockAccount = (role: string, isActive = true) => {
  mockedUser.findById.mockReturnValue({
    select: jest.fn((fields: string) => ({
      lean: jest.fn().mockResolvedValue(fields.includes('role')
        ? { role, isActive }
        : { mustChangePassword: false, passwordChangedAt: null }),
    })),
  } as never);
};

describe('recommendation route account state', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/recommendations', recommendationRouter);
    app.use('/admin/recommendations', adminRecommendationRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  beforeEach(() => jest.clearAllMocks());

  const token = (role: string) => generateAccessToken({
    userId: '665000000000000000000001',
    email: `${role}@example.com`,
    role,
  });

  const request = (path: string, accessToken?: string, method: 'GET' | 'POST' = 'GET') => fetch(
    `${baseUrl}${path}`,
    {
      method,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      ...(method === 'POST' ? { body: '{}' } : {}),
    },
  );

  it('keeps guest recommendation endpoints available without querying an account', async () => {
    await expect(request('/recommendations/me')).resolves.toMatchObject({ status: 204 });
    await expect(request('/recommendations/products/665000000000000000000101/similar'))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/recommendations/events', undefined, 'POST'))
      .resolves.toMatchObject({ status: 204 });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });

  it('allows active users through optional and authenticated recommendation endpoints', async () => {
    mockAccount('user');
    const accessToken = token('user');

    await expect(request('/recommendations/me', accessToken)).resolves.toMatchObject({ status: 204 });
    await expect(request('/recommendations/cart', accessToken)).resolves.toMatchObject({ status: 204 });
  });

  it('blocks inactive users on optional and authenticated recommendation endpoints', async () => {
    mockAccount('user', false);
    const accessToken = token('user');

    await expect(request('/recommendations/me', accessToken)).resolves.toMatchObject({ status: 403 });
    await expect(request('/recommendations/events', accessToken, 'POST')).resolves.toMatchObject({ status: 403 });
    await expect(request('/recommendations/cart', accessToken)).resolves.toMatchObject({ status: 403 });
  });

  it('blocks a recommendation token after the account role changes', async () => {
    mockAccount('staff');

    await expect(request('/recommendations/me', token('user'))).resolves.toMatchObject({ status: 403 });
  });

  it('blocks inactive admins from recommendation reports', async () => {
    mockAccount('admin', false);

    await expect(request('/admin/recommendations/analytics', token('admin')))
      .resolves.toMatchObject({ status: 403 });
  });
});
