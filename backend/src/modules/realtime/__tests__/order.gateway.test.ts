import { Order, User } from '../../../database/models';
import {
  canSubscribeToOrder,
  invalidateOrderSocketPermissionCache,
  resolveOrderSocketMeta,
} from '../order.gateway';

jest.mock('../../../database/models', () => ({
  User: { findById: jest.fn() },
  Order: { exists: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const staffUser = {
  userId: '665000000000000000000001',
  email: 'staff@example.com',
  role: 'staff',
};

const mockStaffRecord = (record: { permissions: string[]; isActive: boolean } | null) => {
  const lean = jest.fn().mockResolvedValue(record);
  mockedUser.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean }) } as never);
};

describe('order realtime authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateOrderSocketPermissionCache();
  });

  it('allows active staff with orders.read', async () => {
    mockStaffRecord({ permissions: ['orders.read'], isActive: true });
    await expect(resolveOrderSocketMeta(staffUser)).resolves.toMatchObject({ scope: 'admin' });
  });

  it('rejects staff without order read access', async () => {
    mockStaffRecord({ permissions: [], isActive: true });
    await expect(resolveOrderSocketMeta(staffUser)).rejects.toThrow('Insufficient permissions');
  });

  it('allows customers to subscribe only to their own orders', async () => {
    const meta = await resolveOrderSocketMeta({ ...staffUser, role: 'user' });
    mockedOrder.exists.mockResolvedValueOnce({ _id: 'order' } as never).mockResolvedValueOnce(null);

    await expect(canSubscribeToOrder(meta, '665000000000000000000002')).resolves.toBe(true);
    await expect(canSubscribeToOrder(meta, '665000000000000000000003')).resolves.toBe(false);
    expect(mockedOrder.exists).toHaveBeenCalledWith(expect.objectContaining({ user_id: staffUser.userId }));
  });

  it('allows admin scope without an ownership query', async () => {
    const meta = await resolveOrderSocketMeta({ ...staffUser, role: 'admin' });
    await expect(canSubscribeToOrder(meta, '665000000000000000000002')).resolves.toBe(true);
    expect(mockedOrder.exists).not.toHaveBeenCalled();
  });
});
