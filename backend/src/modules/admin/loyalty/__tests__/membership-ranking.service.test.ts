import { Types } from 'mongoose';
import { Coupon } from '../../../../database/models/coupon.model';
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
  },
}));
jest.mock('../../../../database/models/user.model', () => ({
  User: { countDocuments: jest.fn() },
}));

const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedMembershipRanking = MembershipRanking as jest.Mocked<typeof MembershipRanking>;
const mockedUser = User as jest.Mocked<typeof User>;
const rankingId = new Types.ObjectId('665000000000000000000101');

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
});
