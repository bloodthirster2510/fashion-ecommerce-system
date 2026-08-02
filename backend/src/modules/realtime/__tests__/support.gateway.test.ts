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

type MockAccountRecord = {
  role: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  passwordChangedAt?: Date | null;
};

const mockStaffRecord = (record: MockAccountRecord | null) => {
  const lean = jest.fn().mockResolvedValue(record);
  const select = jest.fn().mockReturnValue({ lean });
  mockedUser.findById.mockReturnValue({ select } as never);
};

describe('support realtime authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateSupportSocketPermissionCache();
  });

  it('allows active admins whose current role matches the token', async () => {
    mockStaffRecord({ role: 'admin', permissions: [], isActive: true });
    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'admin' })).resolves.toMatchObject({ scope: 'admin' });
    expect(mockedUser.findById).toHaveBeenCalledTimes(1);
  });

  it('allows only active staff with support.reply', async () => {
    mockStaffRecord({ role: 'staff', permissions: ['support.reply'], isActive: true });
    await expect(resolveSupportSocketMeta(staffUser)).resolves.toMatchObject({ scope: 'admin' });
  });

  it.each([
    [{ role: 'staff', permissions: [], isActive: true }],
    [{ role: 'staff', permissions: ['support.reply'], isActive: false }],
    [{ role: 'user', permissions: ['support.reply'], isActive: true }],
    [null],
  ])('rejects unauthorized staff record %#', async (record) => {
    mockStaffRecord(record as MockAccountRecord | null);
    await expect(resolveSupportSocketMeta(staffUser)).rejects.toThrow('Insufficient permissions');
  });

  it('keeps active customers with a current user role in customer scope', async () => {
    mockStaffRecord({ role: 'user', permissions: [], isActive: true });
    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'user' })).resolves.toMatchObject({ scope: 'customer' });
    expect(mockedUser.findById).toHaveBeenCalledTimes(1);
  });

  it('rejects inactive customer sockets', async () => {
    mockStaffRecord({ role: 'user', permissions: [], isActive: false });

    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'user' }))
      .rejects.toThrow('Account access revoked');
  });

  it('rejects a socket token after the account role changes', async () => {
    mockStaffRecord({ role: 'staff', permissions: ['support.reply'], isActive: true });

    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'user' }))
      .rejects.toThrow('Account access revoked');
  });

  it('rejects customer sockets issued before a password change', async () => {
    mockStaffRecord({
      role: 'user',
      permissions: [],
      isActive: true,
      passwordChangedAt: new Date(1_700_000_100 * 1000),
    });

    await expect(resolveSupportSocketMeta({ ...staffUser, role: 'user', iat: 1_700_000_000 }))
      .rejects.toThrow('Account access revoked');
  });

  it('rejects a customer socket changed later within the same second', async () => {
    mockStaffRecord({
      role: 'user',
      permissions: [],
      isActive: true,
      passwordChangedAt: new Date(1_700_000_000_900),
    });

    await expect(resolveSupportSocketMeta({
      ...staffUser,
      role: 'user',
      iat: 1_700_000_000,
      issuedAtMs: 1_700_000_000_100,
    })).rejects.toThrow('Account access revoked');
  });

  it('rejects staff sockets issued before a password change', async () => {
    mockStaffRecord({
      role: 'staff',
      permissions: ['support.reply'],
      isActive: true,
      passwordChangedAt: new Date(1_700_000_100 * 1000),
    });

    await expect(resolveSupportSocketMeta({ ...staffUser, iat: 1_700_000_000 }))
      .rejects.toThrow('Insufficient permissions');
  });

  it('uses the permission cache until explicitly invalidated', async () => {
    mockStaffRecord({ role: 'staff', permissions: ['support.reply'], isActive: true });
    await resolveSupportSocketMeta(staffUser);
    await resolveSupportSocketMeta(staffUser);
    expect(mockedUser.findById).toHaveBeenCalledTimes(1);

    invalidateSupportSocketPermissionCache(staffUser.userId);
    await resolveSupportSocketMeta(staffUser);
    expect(mockedUser.findById).toHaveBeenCalledTimes(2);
  });

  it('allows customers to subscribe only to their own tickets', async () => {
    mockStaffRecord({ role: 'user', permissions: [], isActive: true });
    const meta = await resolveSupportSocketMeta({ ...staffUser, role: 'user' });
    mockedSupportTicket.exists.mockResolvedValueOnce({ _id: 'ticket' } as never).mockResolvedValueOnce(null);

    await expect(canSubscribeToSupportTicket(meta, '665000000000000000000002')).resolves.toBe(true);
    await expect(canSubscribeToSupportTicket(meta, '665000000000000000000003')).resolves.toBe(false);
    expect(mockedSupportTicket.exists).toHaveBeenCalledWith(expect.objectContaining({
      userId: staffUser.userId,
    }));
  });

  it('allows authorized admin-scope sockets without a ticket ownership query', async () => {
    mockStaffRecord({ role: 'admin', permissions: [], isActive: true });
    const meta = await resolveSupportSocketMeta({ ...staffUser, role: 'admin' });
    await expect(canSubscribeToSupportTicket(meta, '665000000000000000000002')).resolves.toBe(true);
    expect(mockedSupportTicket.exists).not.toHaveBeenCalled();
  });
});
