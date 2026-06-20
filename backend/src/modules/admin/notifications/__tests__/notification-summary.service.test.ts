import { Coupon, Inventory, Order, User } from '../../../../database/models';
import { getNotificationSummary } from '../notification-summary.service';

jest.mock('../../../../database/models', () => ({
  Coupon: { countDocuments: jest.fn() },
  Inventory: { aggregate: jest.fn() },
  Order: { aggregate: jest.fn() },
  User: { countDocuments: jest.fn(), findById: jest.fn() },
}));

const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedUser = User as jest.Mocked<typeof User>;

describe('notification summary service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates actionable counts for an admin without double-counting order subsets', async () => {
    mockedOrder.aggregate.mockResolvedValue([{
      _id: null,
      confirmed: 2,
      packed: 1,
      returnRequested: 1,
      online: 1,
      cod: 3,
      total: 4,
    }] as never);
    mockedInventory.aggregate.mockResolvedValue([{ count: 3 }] as never);
    mockedCoupon.countDocuments.mockResolvedValue(2);
    mockedUser.countDocuments.mockResolvedValue(1);

    const summary = await getNotificationSummary(
      { userId: '665000000000000000000001', role: 'admin' },
      new Date('2026-06-20T00:00:00.000Z'),
    );

    expect(summary.total).toBe(10);
    expect(summary.orders).toMatchObject({ total: 4, online: 1, cod: 3 });
    expect(summary).toMatchObject({
      lowStockVariants: 3,
      expiringCoupons: 2,
      inactiveAccounts: 1,
    });
    expect(summary.capabilities).toMatchObject({
      orders: true,
      inventory: true,
      promotions: true,
      accounts: true,
      support: false,
      reviews: false,
    });
  });

  it('queries only sections granted to staff', async () => {
    const lean = jest.fn().mockResolvedValue({ isActive: true, permissions: ['orders.read'] });
    const select = jest.fn().mockReturnValue({ lean });
    mockedUser.findById.mockReturnValue({ select } as never);
    mockedOrder.aggregate.mockResolvedValue([{
      _id: null,
      confirmed: 1,
      packed: 0,
      returnRequested: 0,
      online: 0,
      cod: 1,
      total: 1,
    }] as never);

    const summary = await getNotificationSummary({
      userId: '665000000000000000000002',
      role: 'staff',
    });

    expect(summary.total).toBe(1);
    expect(summary.capabilities).toMatchObject({
      orders: true,
      inventory: false,
      promotions: false,
      accounts: false,
    });
    expect(mockedInventory.aggregate).not.toHaveBeenCalled();
    expect(mockedCoupon.countDocuments).not.toHaveBeenCalled();
    expect(mockedUser.countDocuments).not.toHaveBeenCalled();
  });
});
