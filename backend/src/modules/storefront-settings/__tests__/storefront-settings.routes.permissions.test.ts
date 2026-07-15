import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { User } from '../../../database/models/user.model';
import { generateAccessToken } from '../../../utils/jwt';
import {
  adminStorefrontSettingsRouter,
  storefrontSettingsRouter,
} from '../storefront-settings.route';

jest.mock('../storefront-settings.controller', () => {
  const ok = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => res.status(204).end();
  return {
    getAdminStorefrontSettings: ok,
    getPublicStorefrontSettings: ok,
    updateAdminStorefrontSettings: ok,
  };
});

jest.mock('../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const mockAccount = (role: string, isActive = true) => {
  const lean = jest.fn().mockResolvedValue({ role, isActive });
  const select = jest.fn().mockReturnValue({ lean });
  mockedUser.findById.mockReturnValue({ select } as never);
};

describe('storefront settings route permissions', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/storefront', storefrontSettingsRouter);
    app.use('/admin/settings/storefront', adminStorefrontSettingsRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((caught) => caught ? reject(caught) : resolve()));
  });

  beforeEach(() => jest.clearAllMocks());

  const token = (role: string) => generateAccessToken({
    userId: '665000000000000000000001',
    email: `${role}@example.com`,
    role,
  });

  const adminRequest = (method: 'GET' | 'PATCH', accessToken?: string) => fetch(
    `${baseUrl}/admin/settings/storefront`,
    {
      method,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    },
  );

  it('keeps the public endpoint available without authentication', async () => {
    await expect(fetch(`${baseUrl}/storefront/settings`)).resolves.toMatchObject({ status: 204 });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });

  it('rejects missing and invalid access tokens on admin endpoints', async () => {
    await expect(adminRequest('GET')).resolves.toMatchObject({ status: 401 });
    await expect(adminRequest('GET', 'invalid-token')).resolves.toMatchObject({ status: 401 });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });

  it('rejects non-admin accounts even when they are active', async () => {
    mockAccount('staff');

    await expect(adminRequest('GET', token('staff'))).resolves.toMatchObject({ status: 403 });
  });

  it('rejects inactive admins and tokens whose role no longer matches the database', async () => {
    mockAccount('admin', false);
    await expect(adminRequest('GET', token('admin'))).resolves.toMatchObject({ status: 403 });

    mockAccount('staff');
    await expect(adminRequest('GET', token('admin'))).resolves.toMatchObject({ status: 403 });
  });

  it('returns a server error when account status cannot be checked', async () => {
    const lean = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const select = jest.fn().mockReturnValue({ lean });
    mockedUser.findById.mockReturnValue({ select } as never);

    await expect(adminRequest('GET', token('admin'))).resolves.toMatchObject({ status: 500 });
  });

  it('allows an active admin to read and update settings', async () => {
    mockAccount('admin');

    await expect(adminRequest('GET', token('admin'))).resolves.toMatchObject({ status: 204 });
    await expect(adminRequest('PATCH', token('admin'))).resolves.toMatchObject({ status: 204 });
  });
});
