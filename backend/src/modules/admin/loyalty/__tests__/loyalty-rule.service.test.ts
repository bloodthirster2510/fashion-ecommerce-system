import { LoyaltyRule } from '../../../../database/models';
import { DEFAULT_LOYALTY_RULE, loyaltyRuleService } from '../loyalty-rule.service';

jest.mock('../../../../database/models', () => ({
  LoyaltyRule: {
    find: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

const mockedRule = LoyaltyRule as jest.Mocked<typeof LoyaltyRule>;

describe('loyaltyRuleService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the backward-compatible default when no configured rule is active', async () => {
    mockedRule.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) } as never);
    await expect(loyaltyRuleService.getActiveRuleSnapshot()).resolves.toEqual(DEFAULT_LOYALTY_RULE);
  });

  it('deactivates the previous active rule before creating a new active rule', async () => {
    mockedRule.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedRule.create.mockResolvedValue({ _id: 'new-rule' } as never);

    await loyaltyRuleService.createRule({
      name: 'Double points',
      spendAmount: 1000,
      pointsEarned: 2,
      minOrderAmount: 0,
      roundMode: 'floor',
      isActive: true,
    });

    expect(mockedRule.updateMany).toHaveBeenCalledWith(
      { isActive: true },
      { $set: { isActive: false } },
    );
    expect(mockedRule.create).toHaveBeenCalledWith(expect.objectContaining({ pointsEarned: 2 }));
  });
});
