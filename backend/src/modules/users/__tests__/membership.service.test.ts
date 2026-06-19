import { MembershipRanking } from '../../../database/models';
import { getUserMembership } from '../membership.service';

jest.mock('../../../database/models', () => ({
  MembershipRanking: {
    find: jest.fn(),
  },
}));

const mockedMembershipRanking = MembershipRanking as jest.Mocked<typeof MembershipRanking>;

const mockTiers = (tiers: Array<Record<string, unknown>>) => {
  mockedMembershipRanking.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(tiers),
    }),
  } as never);
};

describe('getUserMembership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a structured empty membership when there are no active tiers', async () => {
    mockTiers([]);

    await expect(getUserMembership('user-id', 0)).resolves.toEqual({
      currentTier: null,
      nextTier: null,
      loyaltyPoint: 0,
      pointToNextTier: null,
      progressPercent: 0,
      tiers: [],
    });
  });

  it('does not assign the first tier before the user reaches its minimum points', async () => {
    mockTiers([
      {
        name: 'Silver',
        level: 2,
        minPoint: 1000,
        maxPoint: null,
        discountPercent: 3,
      },
    ]);

    const result = await getUserMembership('user-id', 0);

    expect(result.currentTier).toBeNull();
    expect(result.nextTier?.name).toBe('Silver');
    expect(result.pointToNextTier).toBe(1000);
    expect(result.progressPercent).toBe(0);
  });

  it('reports completed progress at the highest tier', async () => {
    mockTiers([
      {
        name: 'Member',
        level: 1,
        minPoint: 0,
        maxPoint: 4999,
        discountPercent: 0,
      },
      {
        name: 'Gold',
        level: 2,
        minPoint: 5000,
        maxPoint: null,
        discountPercent: 7,
      },
    ]);

    const result = await getUserMembership('user-id', 6000);

    expect(result.currentTier?.name).toBe('Gold');
    expect(result.nextTier).toBeNull();
    expect(result.pointToNextTier).toBeNull();
    expect(result.progressPercent).toBe(100);
  });
});
