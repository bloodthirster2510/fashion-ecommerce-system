import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { User, type StaffPermission } from '../../../database/models/user.model';
import { generateAccessToken } from '../../../utils/jwt';
import virtualTryOnAdminRouter from '../virtual-try-on.admin.route';

jest.mock('../virtual-try-on.controller', () => {
  const noContent = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) =>
    res.status(204).end();
  return {
    cancelAdminJob: noContent,
    createPromptRule: noContent,
    deletePromptRule: noContent,
    getAdminSettings: noContent,
    getAdminSummary: noContent,
    hideAdminJob: noContent,
    listAccountLocks: noContent,
    listAdminJobs: noContent,
    listPromptViolations: noContent,
    listPromptRules: noContent,
    lockAccount: noContent,
    retryAdminJob: noContent,
    retryAdminVideo: noContent,
    rollbackAdminSettings: noContent,
    testAdminPrompt: noContent,
    unlockAccount: noContent,
    updateAdminSettings: noContent,
    updatePromptRule: noContent,
  };
});

jest.mock('../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const mockAccount = (role: 'admin' | 'staff', permissions: StaffPermission[] = []) => {
  const lean = jest.fn().mockResolvedValue({
    role,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    permissions,
  });
  const select = jest.fn().mockReturnValue({ lean });
  mockedUser.findById.mockReturnValue({ select } as never);
};

describe('virtual try-on settings route permissions', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/admin/virtual-try-on', virtualTryOnAdminRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((caught) => caught ? reject(caught) : resolve());
    });
  });

  beforeEach(() => jest.clearAllMocks());

  const token = (role: 'admin' | 'staff') => generateAccessToken({
    userId: '665000000000000000000001',
    email: `${role}@example.com`,
    role,
  });

  const request = (path: string, method: 'GET' | 'PATCH' | 'POST' | 'DELETE', accessToken: string) => fetch(
    `${baseUrl}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(method === 'GET' ? {} : { body: '{}' }),
    },
  );

  it('keeps settings and policy tools hidden from read-only staff', async () => {
    mockAccount('staff', ['virtual_try_on.read']);

    await expect(request('/admin/virtual-try-on/settings', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/prompt-rules', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/account-locks', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/prompt-violations', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/settings', 'PATCH', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/settings/rollback', 'POST', token('staff')))
      .resolves.toMatchObject({ status: 403 });
  });

  it('allows staff with the settings permission to update and roll back', async () => {
    mockAccount('staff', ['virtual_try_on.settings']);

    await expect(request('/admin/virtual-try-on/settings', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/prompt-rules', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/prompt-violations', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/settings', 'PATCH', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/settings/rollback', 'POST', token('staff')))
      .resolves.toMatchObject({ status: 204 });
  });

  it('keeps account operations separate from content settings', async () => {
    mockAccount('staff', ['virtual_try_on.manage']);

    await expect(request('/admin/virtual-try-on/account-locks', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/prompt-violations', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/account-locks', 'POST', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/account-locks/665000000000000000000002', 'DELETE', token('staff')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/settings', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
    await expect(request('/admin/virtual-try-on/prompt-rules', 'GET', token('staff')))
      .resolves.toMatchObject({ status: 403 });
  });

  it('allows admins without an explicit permission list', async () => {
    mockAccount('admin');

    await expect(request('/admin/virtual-try-on/settings', 'PATCH', token('admin')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/settings/rollback', 'POST', token('admin')))
      .resolves.toMatchObject({ status: 204 });
    await expect(request('/admin/virtual-try-on/prompt-violations', 'GET', token('admin')))
      .resolves.toMatchObject({ status: 204 });
  });
});
