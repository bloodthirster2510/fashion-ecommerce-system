import mongoose, { Types, type ClientSession } from 'mongoose';
import { LoyaltyRule, type LoyaltyRuleRoundMode } from '../../../database/models';

export type LoyaltyRulePayload = {
  name?: unknown;
  spendAmount?: unknown;
  pointsEarned?: unknown;
  minOrderAmount?: unknown;
  roundMode?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  isActive?: unknown;
};

export const DEFAULT_LOYALTY_RULE = {
  ruleId: null,
  name: 'Default 1 point / 1,000 VND',
  spendAmount: 1000,
  pointsEarned: 1,
  minOrderAmount: 0,
  roundMode: 'floor' as LoyaltyRuleRoundMode,
};

export class LoyaltyRuleServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'LoyaltyRuleServiceError';
  }
}

function assertObjectPayload(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new LoyaltyRuleServiceError('Request body must be an object', 400);
  }
}

const rethrowLoyaltyRuleWriteError = (error: unknown): never => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    throw new LoyaltyRuleServiceError('Another loyalty rule is already active', 409);
  }

  throw error;
};

const parseNumber = (value: unknown, field: string, required: boolean) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new LoyaltyRuleServiceError(`${field} is required`, 400);
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new LoyaltyRuleServiceError(`${field} must be a number`, 400);
  return number;
};

const parseDate = (value: unknown, field: string) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) throw new LoyaltyRuleServiceError(`${field} is invalid`, 400);
  return date;
};

const normalizePayload = (payload: LoyaltyRulePayload, mode: 'create' | 'update') => {
  assertObjectPayload(payload);
  const required = mode === 'create';
  const data: Record<string, unknown> = {};
  if (payload.name !== undefined || required) {
    if (typeof payload.name !== 'string' || payload.name.trim().length < 2) {
      throw new LoyaltyRuleServiceError('name must include at least 2 characters', 400);
    }
    data.name = payload.name.trim();
  }

  const spendAmount = parseNumber(payload.spendAmount, 'spendAmount', required);
  const pointsEarned = parseNumber(payload.pointsEarned, 'pointsEarned', required);
  const minOrderAmount = parseNumber(payload.minOrderAmount, 'minOrderAmount', false);
  if (spendAmount !== undefined) {
    if (!Number.isInteger(spendAmount) || spendAmount < 1 || spendAmount > 100000000) {
      throw new LoyaltyRuleServiceError('spendAmount must be a positive integer', 400);
    }
    data.spendAmount = spendAmount;
  }
  if (pointsEarned !== undefined) {
    if (!Number.isInteger(pointsEarned) || pointsEarned < 1 || pointsEarned > 1000000) {
      throw new LoyaltyRuleServiceError('pointsEarned must be a positive integer', 400);
    }
    data.pointsEarned = pointsEarned;
  }
  if (minOrderAmount !== undefined) {
    if (!Number.isInteger(minOrderAmount) || minOrderAmount < 0) {
      throw new LoyaltyRuleServiceError('minOrderAmount must be a non-negative integer', 400);
    }
    data.minOrderAmount = minOrderAmount;
  } else if (required) data.minOrderAmount = 0;

  if (payload.roundMode !== undefined || required) {
    const roundMode = payload.roundMode ?? 'floor';
    if (!['floor', 'round', 'ceil'].includes(String(roundMode))) {
      throw new LoyaltyRuleServiceError('roundMode is invalid', 400);
    }
    data.roundMode = roundMode;
  }

  const startAt = parseDate(payload.startAt, 'startAt');
  const endAt = parseDate(payload.endAt, 'endAt');
  if (startAt !== undefined) data.startAt = startAt;
  if (endAt !== undefined) data.endAt = endAt;
  if (startAt instanceof Date && endAt instanceof Date && endAt <= startAt) {
    throw new LoyaltyRuleServiceError('endAt must be after startAt', 400);
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') throw new LoyaltyRuleServiceError('isActive must be a boolean', 400);
    data.isActive = payload.isActive;
  } else if (required) data.isActive = true;
  if (!required && Object.keys(data).length === 0) {
    throw new LoyaltyRuleServiceError('No data to update', 400);
  }
  return data;
};

const listRules = () => LoyaltyRule.find().sort({ createdAt: -1 }).lean();

const deactivateOtherRules = async (exceptId?: string, session?: ClientSession) => {
  const filter = exceptId ? { _id: { $ne: new Types.ObjectId(exceptId) }, isActive: true } : { isActive: true };
  await LoyaltyRule.updateMany(filter, { $set: { isActive: false } }, { session });
};

const createRule = async (payload: LoyaltyRulePayload, actorId?: string) => {
  const data = normalizePayload(payload, 'create');
  if (actorId && Types.ObjectId.isValid(actorId)) {
    data.createdBy = new Types.ObjectId(actorId);
    data.updatedBy = new Types.ObjectId(actorId);
  }

  if (!data.isActive) {
    try {
      return await LoyaltyRule.create(data);
    } catch (error) {
      return rethrowLoyaltyRuleWriteError(error);
    }
  }

  const session = await mongoose.startSession();
  let createdRule: unknown;
  try {
    await session.withTransaction(async () => {
      await deactivateOtherRules(undefined, session);
      const [rule] = await LoyaltyRule.create([data], { session });
      createdRule = rule;
    });
  } catch (error) {
    return rethrowLoyaltyRuleWriteError(error);
  } finally {
    await session.endSession();
  }

  if (!createdRule) {
    throw new LoyaltyRuleServiceError('Loyalty rule creation was not committed', 500);
  }
  return createdRule;
};

const updateRule = async (id: string, payload: LoyaltyRulePayload, actorId?: string) => {
  if (!Types.ObjectId.isValid(id)) throw new LoyaltyRuleServiceError('Invalid loyalty rule id', 400);
  const current = await LoyaltyRule.findById(id);
  if (!current) throw new LoyaltyRuleServiceError('Loyalty rule not found', 404);
  const data = normalizePayload(payload, 'update');
  const startAt = data.startAt === undefined ? current.startAt : data.startAt as Date | null;
  const endAt = data.endAt === undefined ? current.endAt : data.endAt as Date | null;
  if (startAt && endAt && endAt <= startAt) throw new LoyaltyRuleServiceError('endAt must be after startAt', 400);
  if (actorId && Types.ObjectId.isValid(actorId)) data.updatedBy = new Types.ObjectId(actorId);

  if (data.isActive === true) {
    const session = await mongoose.startSession();
    let updatedRule: unknown;
    try {
      await session.withTransaction(async () => {
        await deactivateOtherRules(id, session);
        updatedRule = await LoyaltyRule.findByIdAndUpdate(
          id,
          { $set: data },
          { returnDocument: 'after', runValidators: true, session },
        );
        if (!updatedRule) {
          throw new LoyaltyRuleServiceError('Loyalty rule not found', 404);
        }
      });
    } catch (error) {
      if (error instanceof LoyaltyRuleServiceError) throw error;
      return rethrowLoyaltyRuleWriteError(error);
    } finally {
      await session.endSession();
    }
    return updatedRule;
  }

  try {
    const updatedRule = await LoyaltyRule.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    );
    if (!updatedRule) throw new LoyaltyRuleServiceError('Loyalty rule not found', 404);
    return updatedRule;
  } catch (error) {
    if (error instanceof LoyaltyRuleServiceError) throw error;
    return rethrowLoyaltyRuleWriteError(error);
  }
};

const deleteRule = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new LoyaltyRuleServiceError('Invalid loyalty rule id', 400);
  const rule = await LoyaltyRule.findByIdAndDelete(id);
  if (!rule) throw new LoyaltyRuleServiceError('Loyalty rule not found', 404);
  return rule;
};

const getActiveRuleSnapshot = async (now = new Date()) => {
  const rule = await LoyaltyRule.findOne({
    isActive: true,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  }).sort({ updatedAt: -1 });

  return rule ? {
    ruleId: rule._id.toString(),
    name: rule.name,
    spendAmount: rule.spendAmount,
    pointsEarned: rule.pointsEarned,
    minOrderAmount: rule.minOrderAmount,
    roundMode: rule.roundMode,
  } : DEFAULT_LOYALTY_RULE;
};

export const loyaltyRuleService = { listRules, createRule, updateRule, deleteRule, getActiveRuleSnapshot };
