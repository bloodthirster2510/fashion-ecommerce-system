import mongoose from 'mongoose';
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
const mockSession = {
  withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
  endSession: jest.fn(),
};
const startSessionSpy = jest.spyOn(mongoose, 'startSession');

describe('loyaltyRuleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    startSessionSpy.mockResolvedValue(mockSession as never);
  });

  it('uses the backward-compatible default when no configured rule is active', async () => {
    mockedRule.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) } as never);
    await expect(loyaltyRuleService.getActiveRuleSnapshot()).resolves.toEqual(DEFAULT_LOYALTY_RULE);
  });

  it('deactivates the previous active rule before creating a new active rule', async () => {
    mockedRule.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedRule.create.mockResolvedValue([{ _id: 'new-rule' }] as never);

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
      { session: mockSession },
    );
    expect(mockedRule.create).toHaveBeenCalledWith(
      [expect.objectContaining({ pointsEarned: 2 })],
      { session: mockSession },
    );
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('keeps active-rule replacement in one transaction when creation fails', async () => {
    mockedRule.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedRule.create.mockRejectedValue(new Error('write failed'));

    await expect(loyaltyRuleService.createRule({
      name: 'Double points',
      spendAmount: 1000,
      pointsEarned: 2,
      isActive: true,
    })).rejects.toThrow('write failed');

    expect(mockedRule.updateMany).toHaveBeenCalledWith(
      { isActive: true },
      { $set: { isActive: false } },
      { session: mockSession },
    );
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects a null request body as a validation error', async () => {
    await expect(loyaltyRuleService.createRule(null as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('reports a concurrent deletion during update instead of returning null', async () => {
    mockedRule.findById.mockResolvedValue({ startAt: null, endAt: null } as never);
    mockedRule.findByIdAndUpdate.mockResolvedValue(null);

    await expect(loyaltyRuleService.updateRule(
      '665000000000000000000301',
      { name: 'Updated rule' },
    )).rejects.toMatchObject({ statusCode: 404 });
  });

  it('activates an existing rule and deactivates the previous rule in one transaction', async () => {
    const updatedRule = { _id: '665000000000000000000301', isActive: true };
    mockedRule.findById.mockResolvedValue({ startAt: null, endAt: null } as never);
    mockedRule.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedRule.findByIdAndUpdate.mockResolvedValue(updatedRule as never);

    await expect(loyaltyRuleService.updateRule(
      '665000000000000000000301',
      { isActive: true },
    )).resolves.toBe(updatedRule);

    expect(mockedRule.updateMany).toHaveBeenCalledWith(
      { _id: { $ne: expect.anything() }, isActive: true },
      { $set: { isActive: false } },
      { session: mockSession },
    );
    expect(mockedRule.findByIdAndUpdate).toHaveBeenCalledWith(
      '665000000000000000000301',
      { $set: { isActive: true } },
      { returnDocument: 'after', runValidators: true, session: mockSession },
    );
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });
});
