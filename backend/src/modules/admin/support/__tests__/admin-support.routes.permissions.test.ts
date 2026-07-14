import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { generateAccessToken } from '../../../../utils/jwt';
import { User } from '../../../../database/models/user.model';
import adminSupportRouter from '../admin-support.routes';

jest.mock('../admin-support.controller', () => {
  const ok = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) => res.status(204).end();
  return {
    createFaq: ok,
    createCannedResponse: ok,
    deleteCannedResponse: ok,
    deleteFaq: ok,
    getSummary: ok,
    getAnalytics: ok,
    getTicket: ok,
    listFaqs: ok,
    listCannedResponses: ok,
    listAssignees: ok,
    listTickets: ok,
    markTicketRead: ok,
    reorderFaqs: ok,
    replyTicket: ok,
    updateFaq: ok,
    updateCannedResponse: ok,
    updateTicket: ok,
  };
});

jest.mock('../../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const mockStaffPermissions = (permissions: string[], isActive = true) => {
  const lean = jest.fn().mockResolvedValue({ permissions, isActive });
  const select = jest.fn().mockReturnValue({ lean });
  mockedUser.findById.mockReturnValue({ select } as never);
};

describe('admin support route permissions', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/admin/support', adminSupportRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/admin/support`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => jest.clearAllMocks());

  const request = (path: string, role = 'staff') => {
    const token = generateAccessToken({
      userId: '665000000000000000000001',
      email: `${role}@example.com`,
      role,
    });
    return fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  };

  it('lets reply-only staff use tickets but blocks content management and analytics', async () => {
    mockStaffPermissions(['support.reply']);

    await expect(request('/tickets')).resolves.toMatchObject({ status: 204 });
    await expect(request('/assignees')).resolves.toMatchObject({ status: 204 });
    await expect(request('/analytics')).resolves.toMatchObject({ status: 403 });
    await expect(request('/canned-responses')).resolves.toMatchObject({ status: 403 });
    await expect(request('/faqs')).resolves.toMatchObject({ status: 403 });
  });

  it('lets staff with support.manage access management routes', async () => {
    mockStaffPermissions(['support.reply', 'support.manage']);

    await expect(request('/analytics')).resolves.toMatchObject({ status: 204 });
    await expect(request('/canned-responses')).resolves.toMatchObject({ status: 204 });
    await expect(request('/faqs')).resolves.toMatchObject({ status: 204 });
  });

  it('blocks staff without support.reply from ticket routes', async () => {
    mockStaffPermissions([]);
    await expect(request('/tickets')).resolves.toMatchObject({ status: 403 });
  });

  it('lets admins bypass staff permission lookups', async () => {
    await expect(request('/analytics', 'admin')).resolves.toMatchObject({ status: 204 });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });
});
