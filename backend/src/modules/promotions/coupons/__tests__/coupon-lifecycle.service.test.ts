import { Coupon } from '../../../../database/models';
import { couponLifecycleService } from '../coupon-lifecycle.service';

jest.mock('../../../../database/models', () => ({
  Coupon: { updateMany: jest.fn() },
}));

const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;

describe('couponLifecycleService', () => {
  it('synchronizes expired, paused, upcoming, and active statuses', async () => {
    mockedCoupon.updateMany
      .mockResolvedValueOnce({ modifiedCount: 2 } as never)
      .mockResolvedValueOnce({ modifiedCount: 1 } as never)
      .mockResolvedValueOnce({ modifiedCount: 3 } as never)
      .mockResolvedValueOnce({ modifiedCount: 4 } as never);

    await expect(couponLifecycleService.syncLifecycleStatuses(new Date('2026-06-19T00:00:00Z')))
      .resolves.toEqual({ modifiedCount: 10 });
    expect(mockedCoupon.updateMany).toHaveBeenCalledTimes(4);
  });
});
