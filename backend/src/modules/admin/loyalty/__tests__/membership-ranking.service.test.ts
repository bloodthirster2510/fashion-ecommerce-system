import mongoose, { Types } from 'mongoose';
import { Coupon } from '../../../../database/models/coupon.model';
import { LoyaltyPointHistory } from '../../../../database/models/loyalty-point-history.model';
import { MembershipRanking } from '../../../../database/models/membership-ranking.model';
import { User } from '../../../../database/models/user.model';
import {
  MembershipRankingServiceError,
  membershipRankingAdminService,
} from '../membership-ranking.service';

jest.mock('../../../../database/models/coupon.model', () => ({
  Coupon: { countDocuments: jest.fn() },
}));
jest.mock('../../../../database/models/membership-ranking.model', () => ({
  MembershipRanking: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    insertMany: jest.fn(),
  },
}));
jest.mock('../../../../database/models/loyalty-point-history.model', () => ({
  LoyaltyPointHistory: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));
jest.mock('../../../../database/models/user.model', () => ({
  User: {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedLoyaltyPointHistory = LoyaltyPointHistory as jest.Mocked<typeof LoyaltyPointHistory>;
const mockedMembershipRanking = MembershipRanking as jest.Mocked<typeof MembershipRanking>;
const mockedUser = User as jest.Mocked<typeof User>;
const rankingId = new Types.ObjectId('665000000000000000000101');
const loyaltyUserId = new Types.ObjectId('665000000000000000000201');
const actorId = new Types.ObjectId('665000000000000000000202');
const mockSession = {
  withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
  endSession: jest.fn(),
};
const startSessionSpy = jest.spyOn(mongoose, 'startSession');

const mockNextTier = (minPoint?: number) => {
  mockedMembershipRanking.findOne.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(minPoint === undefined ? null : { minPoint }),
      }),
    }),
  } as never);
};

describe('membershipRankingAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    startSessionSpy.mockResolvedValue(mockSession as never);
  });

  it('derives maxPoint from the next configured tier', async () => {
    mockedMembershipRanking.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: rankingId, level: 1, minPoint: 0, maxPoint: null },
          { _id: new Types.ObjectId(), level: 2, minPoint: 5000, maxPoint: null },
        ]),
      }),
    } as never);
    mockedUser.countDocuments
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    const result = await membershipRankingAdminService.listMembershipRankings();

    expect(result[0].maxPoint).toBe(4999);
    expect(result[0].memberCount).toBe(5);
    expect(result[1].maxPoint).toBeNull();
    expect(result[1].memberCount).toBe(2);
  });

  it('does not delete the base tier', async () => {
    mockedMembershipRanking.findById.mockResolvedValue({
      _id: rankingId,
      minPoint: 0,
    } as never);

    await expect(
      membershipRankingAdminService.deleteMembershipRanking(rankingId.toString()),
    ).rejects.toBeInstanceOf(MembershipRankingServiceError);

    expect(mockedMembershipRanking.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('does not delete a tier that still has members', async () => {
    mockedMembershipRanking.findById.mockResolvedValue({
      _id: rankingId,
      minPoint: 5000,
    } as never);
    mockNextTier(10000);
    mockedUser.countDocuments.mockResolvedValue(2);

    await expect(
      membershipRankingAdminService.deleteMembershipRanking(rankingId.toString()),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockedCoupon.countDocuments).not.toHaveBeenCalled();
    expect(mockedMembershipRanking.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('hard deletes an unused, unreferenced tier', async () => {
    const ranking = { _id: rankingId, minPoint: 5000 };
    mockedMembershipRanking.findById.mockResolvedValue(ranking as never);
    mockNextTier();
    mockedUser.countDocuments.mockResolvedValue(0);
    mockedCoupon.countDocuments.mockResolvedValue(0);
    mockedMembershipRanking.findByIdAndDelete.mockResolvedValue(ranking as never);

    await expect(
      membershipRankingAdminService.deleteMembershipRanking(rankingId.toString()),
    ).resolves.toBe(ranking);
  });

  it('creates a complete tier template in one transaction', async () => {
    mockedMembershipRanking.exists.mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as never);
    mockedMembershipRanking.insertMany.mockResolvedValue([{ name: 'Đồng' }, { name: 'Bạc' }] as never);

    const result = await membershipRankingAdminService.createMembershipRankingsBatch({
      rankings: [
        { name: 'Đồng', level: 1, minPoint: 0, discountPercent: 0, benefitDescription: 'Hạng cơ bản' },
        { name: 'Bạc', level: 2, minPoint: 1000, discountPercent: 3, benefitDescription: 'Hạng bạc' },
      ],
    });

    expect(result).toHaveLength(2);
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockedMembershipRanking.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Đồng', level: 1, minPoint: 0 })]),
      { session: mockSession },
    );
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('adjusts loyalty points and writes history in the same transaction', async () => {
    const user = {
      _id: loyaltyUserId,
      name: 'Loyal Customer',
      email: 'loyal@example.com',
      loyaltyPoint: 1200,
      membershipUpdatedAt: null,
      save: jest.fn(),
    };
    mockedUser.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(user),
    } as never);
    mockedLoyaltyPointHistory.create.mockResolvedValue([{ _id: new Types.ObjectId() }] as never);

    const result = await membershipRankingAdminService.adjustLoyaltyPoints(
      { userId: loyaltyUserId.toString(), delta: -200, reason: 'Support correction' },
      { actorId: actorId.toString(), actorRole: 'staff' },
    );

    expect(result).toMatchObject({ balanceBefore: 1200, balanceAfter: 1000 });
    expect(user.loyaltyPoint).toBe(1000);
    expect(user.save).toHaveBeenCalledWith({ session: mockSession });
    expect(mockedLoyaltyPointHistory.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        userId: loyaltyUserId,
        delta: -200,
        balanceAfter: 1000,
        actorId,
        actorRole: 'staff',
      })],
      { session: mockSession },
    );
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects an adjustment that would make the balance negative', async () => {
    const user = {
      _id: loyaltyUserId,
      name: 'Loyal Customer',
      email: 'loyal@example.com',
      loyaltyPoint: 100,
      save: jest.fn(),
    };
    mockedUser.findOne.mockReturnValue({
      session: jest.fn().mockResolvedValue(user),
    } as never);

    await expect(membershipRankingAdminService.adjustLoyaltyPoints(
      { userId: loyaltyUserId.toString(), delta: -101, reason: 'Support correction' },
      { actorId: actorId.toString(), actorRole: 'admin' },
    )).rejects.toMatchObject({ statusCode: 409 });

    expect(user.save).not.toHaveBeenCalled();
    expect(mockedLoyaltyPointHistory.create).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });
});
