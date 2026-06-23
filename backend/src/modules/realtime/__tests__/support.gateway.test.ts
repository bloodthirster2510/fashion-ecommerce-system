import { SupportTicket, User } from '../../../database/models';
import {
  canSubscribeToSupportTicket,
  invalidateSupportSocketPermissionCache,
  resolveSupportSocketMeta,
} from '../support.gateway';

jest.mock('../../../database/models', () => ({
  User: { findById: jest.fn() },
  SupportTicket: { exists: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;
const mockedSupportTicket = SupportTicket as jest.Mocked<typeof SupportTicket>;

const staffUser = {
  userId: '665000000000000000000001',
  email: 'staff@example.com',
  role: 'staff',
};

const mockStaffRecord = (record: { permissions: string[]; isActive: boolean } | null) => {
  const lean = jest.fn().mockResolvedValue(record);
  const select = jest.fn().mockReturnValue({ lean });
  mockedUser.findById.mockReturnValue({ select } as never);
};

describe('support realtime authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateSupportSocketPermissionCache();
  });

  it('allows admins without querying staff permissions', async () => {
    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'admin' })).resolves.toMatchObject({ scope: 'admin' });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });

  it('allows only active staff with support.reply', async () => {
    mockStaffRecord({ permissions: ['support.reply'], isActive: true });
    await expect(resolveSupportSocketMeta(staffUser)).resolves.toMatchObject({ scope: 'admin' });
  });

  it.each([
    [{ permissions: [], isActive: true }],
    [{ permissions: ['support.reply'], isActive: false }],
    [null],
  ])('rejects unauthorized staff record %#', async (record) => {
    mockStaffRecord(record as { permissions: string[]; isActive: boolean } | null);
    await expect(resolveSupportSocketMeta(staffUser)).rejects.toThrow('Insufficient permissions');
  });

  it('keeps customers in customer scope without loading staff permissions', async () => {
    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'user' })).resolves.toMatchObject({ scope: 'customer' });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });

  it('uses the permission cache until explicitly invalidated', async () => {
    mockStaffRecord({ permissions: ['support.reply'], isActive: true });
    await resolveSupportSocketMeta(staffUser);
    await resolveSupportSocketMeta(staffUser);
    expect(mockedUser.findById).toHaveBeenCalledTimes(1);

    invalidateSupportSocketPermissionCache(staffUser.userId);
    await resolveSupportSocketMeta(staffUser);
    expect(mockedUser.findById).toHaveBeenCalledTimes(2);
  });

  it('allows customers to subscribe only to their own tickets', async () => {
    const meta = await resolveSupportSocketMeta({ ...staffUser, role: 'user' });
    mockedSupportTicket.exists.mockResolvedValueOnce({ _id: 'ticket' } as never).mockResolvedValueOnce(null);

    await expect(canSubscribeToSupportTicket(meta, '665000000000000000000002')).resolves.toBe(true);
    await expect(canSubscribeToSupportTicket(meta, '665000000000000000000003')).resolves.toBe(false);
    expect(mockedSupportTicket.exists).toHaveBeenCalledWith(expect.objectContaining({
      userId: staffUser.userId,
    }));
  });

  it('allows authorized admin-scope sockets without a ticket ownership query', async () => {
    const meta = await resolveSupportSocketMeta({ ...staffUser, role: 'admin' });
    await expect(canSubscribeToSupportTicket(meta, '665000000000000000000002')).resolves.toBe(true);
    expect(mockedSupportTicket.exists).not.toHaveBeenCalled();
  });
});
