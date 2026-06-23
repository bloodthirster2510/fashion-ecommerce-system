import { Coupon } from '../../../database/models';

const syncLifecycleStatuses = async (now = new Date()) => {
  const [expired, paused, upcoming, active] = await Promise.all([
    Coupon.updateMany(
      { deletedAt: null, endAt: { $lt: now }, lifecycleStatus: { $ne: 'expired' } },
      { $set: { lifecycleStatus: 'expired' } },
    ),
    Coupon.updateMany(
      { deletedAt: null, isActive: false, endAt: { $gte: now }, lifecycleStatus: { $ne: 'paused' } },
      { $set: { lifecycleStatus: 'paused' } },
    ),
    Coupon.updateMany(
      { deletedAt: null, isActive: true, startAt: { $gt: now }, endAt: { $gte: now }, lifecycleStatus: { $ne: 'upcoming' } },
      { $set: { lifecycleStatus: 'upcoming' } },
    ),
    Coupon.updateMany(
      {
        deletedAt: null,
        isActive: true,
        startAt: { $lte: now },
        endAt: { $gte: now },
        lifecycleStatus: { $ne: 'active' },
      },
      { $set: { lifecycleStatus: 'active' } },
    ),
  ]);

  return {
    modifiedCount: [expired, paused, upcoming, active]
      .reduce((sum, result) => sum + (result.modifiedCount ?? 0), 0),
  };
};

export const couponLifecycleService = { syncLifecycleStatuses };
