import mongoose, { Types } from 'mongoose';
import { MembershipRanking } from '../../../database/models/membership-ranking.model';
import { Coupon } from '../../../database/models/coupon.model';
import { LoyaltyPointHistory } from '../../../database/models/loyalty-point-history.model';
import { User } from '../../../database/models/user.model';
import {
  getMembershipVisualPreset,
  hexColorRegex,
  iconNameRegex,
  resolveMembershipVisualConfig,
} from '../../../database/membership-visual';

export type MembershipRankingPayload = {
  name?: unknown;
  level?: unknown;
  minPoint?: unknown;
  maxPoint?: unknown;
  discountPercent?: unknown;
  benefitDescription?: unknown;
  cardColor?: unknown;
  textColor?: unknown;
  badgeColor?: unknown;
  iconName?: unknown;
  isActive?: unknown;
};

export type LoyaltyPointAdjustmentPayload = {
  userId?: unknown;
  delta?: unknown;
  reason?: unknown;
};

export type LoyaltyPointAdjustmentActor = {
  actorId?: string | null;
  actorRole: 'admin' | 'staff';
};

type LoyaltyPointQuery = {
  userId?: unknown;
  tierId?: unknown;
  keyword?: unknown;
  page?: unknown;
  limit?: unknown;
};

type NormalizedMembershipRanking = {
  name: string;
  level: number;
  minPoint: number;
  maxPoint: number | null;
  discountPercent: number;
  benefitDescription: string;
  cardColor: string;
  textColor: string;
  badgeColor: string;
  iconName: string;
  isActive: boolean;
};

type PartialMembershipRanking = Partial<NormalizedMembershipRanking>;

export class MembershipRankingServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'MembershipRankingServiceError';
  }
}

const assertValidId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new MembershipRankingServiceError('Invalid membership ranking id', 400);
  }
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const firstString = (value: unknown) => {
  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  return typeof value === 'string' ? value.trim() : undefined;
};

const parsePositiveInteger = (value: unknown, fallback: number, max: number) => {
  const rawValue = firstString(value);
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? Math.min(parsedValue, max)
    : fallback;
};

const parseString = (value: unknown, field: string, required: boolean) => {
  if (value === undefined || value === null) {
    if (required) {
      throw new MembershipRankingServiceError(`${field} is required`, 400);
    }

    return undefined;
  }

  if (typeof value !== 'string') {
    throw new MembershipRankingServiceError(`${field} must be a string`, 400);
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new MembershipRankingServiceError(`${field} is required`, 400);
  }

  return trimmed || undefined;
};

const parseNumber = (value: unknown, field: string, required: boolean) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new MembershipRankingServiceError(`${field} is required`, 400);
    }

    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new MembershipRankingServiceError(`${field} must be a number`, 400);
  }

  return numericValue;
};

const parseBoolean = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new MembershipRankingServiceError('isActive must be a boolean', 400);
  }

  return value;
};

const parseHexColor = (value: unknown, field: string) => {
  const color = parseString(value, field, false);
  if (color === undefined) {
    return undefined;
  }

  if (!hexColorRegex.test(color)) {
    throw new MembershipRankingServiceError(`${field} must be a hex color like #5b788a`, 400);
  }

  return color.toLowerCase();
};

const parseIconName = (value: unknown) => {
  const iconName = parseString(value, 'iconName', false);
  if (iconName === undefined) {
    return undefined;
  }

  if (!iconNameRegex.test(iconName)) {
    throw new MembershipRankingServiceError('iconName must use lowercase letters, numbers, and hyphens', 400);
  }

  return iconName.toLowerCase();
};

const assertIntegerInRange = (value: number, field: string, min: number, max: number) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new MembershipRankingServiceError(`${field} must be an integer from ${min} to ${max}`, 400);
  }
};

function normalizePayload(payload: MembershipRankingPayload, mode: 'create'): NormalizedMembershipRanking;
function normalizePayload(payload: MembershipRankingPayload, mode: 'update'): PartialMembershipRanking;
function normalizePayload(payload: MembershipRankingPayload, mode: 'create' | 'update') {
  const required = mode === 'create';
  const normalized: PartialMembershipRanking = {};
  const name = parseString(payload.name, 'name', required);
  const level = parseNumber(payload.level, 'level', required);
  const minPoint = parseNumber(payload.minPoint, 'minPoint', required);
  const maxPoint = payload.maxPoint === null ? null : parseNumber(payload.maxPoint, 'maxPoint', false);
  const discountPercent = parseNumber(payload.discountPercent, 'discountPercent', required);
  const benefitDescription = parseString(payload.benefitDescription, 'benefitDescription', required);
  const cardColor = parseHexColor(payload.cardColor, 'cardColor');
  const textColor = parseHexColor(payload.textColor, 'textColor');
  const badgeColor = parseHexColor(payload.badgeColor, 'badgeColor');
  const iconName = parseIconName(payload.iconName);
  const isActive = parseBoolean(payload.isActive);

  if (name !== undefined) normalized.name = name;
  if (level !== undefined) {
    assertIntegerInRange(level, 'level', 1, 20);
    normalized.level = level;
  }
  if (minPoint !== undefined) {
    assertIntegerInRange(minPoint, 'minPoint', 0, 100000000);
    normalized.minPoint = minPoint;
  }
  if (maxPoint !== undefined || payload.maxPoint === null) {
    if (maxPoint !== null) {
      assertIntegerInRange(maxPoint as number, 'maxPoint', 0, 100000000);
    }
    normalized.maxPoint = maxPoint ?? null;
  }
  if (discountPercent !== undefined) {
    if (discountPercent < 0 || discountPercent > 100) {
      throw new MembershipRankingServiceError('discountPercent must be from 0 to 100', 400);
    }
    normalized.discountPercent = discountPercent;
  }
  if (benefitDescription !== undefined) normalized.benefitDescription = benefitDescription;
  if (cardColor !== undefined) normalized.cardColor = cardColor;
  if (textColor !== undefined) normalized.textColor = textColor;
  if (badgeColor !== undefined) normalized.badgeColor = badgeColor;
  if (iconName !== undefined) normalized.iconName = iconName;
  if (isActive !== undefined) normalized.isActive = isActive;

  if (normalized.maxPoint !== undefined && normalized.maxPoint !== null) {
    const minPointToCompare = normalized.minPoint ?? Number(payload.minPoint);
    if (Number.isFinite(minPointToCompare) && normalized.maxPoint < minPointToCompare) {
      throw new MembershipRankingServiceError('maxPoint must be greater than or equal to minPoint', 400);
    }
  }

  if (mode === 'create') {
    const defaultVisualConfig = getMembershipVisualPreset(normalized.level);

    return {
      ...defaultVisualConfig,
      ...normalized,
      isActive: normalized.isActive ?? true,
    } as NormalizedMembershipRanking;
  }

  if (Object.keys(normalized).length === 0) {
    throw new MembershipRankingServiceError('No data to update', 400);
  }

  return normalized;
}

const findByName = (name: string) => {
  return MembershipRanking.findOne({
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
  });
};

const assertUniqueNameAndLevel = async (
  payload: PartialMembershipRanking,
  currentId?: string,
) => {
  if (payload.name) {
    const existingName = await findByName(payload.name);
    if (existingName && existingName._id.toString() !== currentId) {
      throw new MembershipRankingServiceError('Membership ranking name already exists', 409);
    }
  }

  if (payload.level !== undefined) {
    const existingLevel = await MembershipRanking.findOne({ level: payload.level });
    if (existingLevel && existingLevel._id.toString() !== currentId) {
      throw new MembershipRankingServiceError('Membership ranking level already exists', 409);
    }
  }
};

const assertValidPointRangeForUpdate = (
  current: { minPoint: number; maxPoint: number | null },
  payload: PartialMembershipRanking,
) => {
  const minPoint = payload.minPoint ?? current.minPoint;
  const maxPoint = payload.maxPoint === undefined ? current.maxPoint : payload.maxPoint;

  if (maxPoint !== null && maxPoint < minPoint) {
    throw new MembershipRankingServiceError('maxPoint must be greater than or equal to minPoint', 400);
  }
};

const assertBaseTierStartsAtZero = (
  current: { level: number; minPoint: number; isActive: boolean },
  payload: PartialMembershipRanking,
) => {
  const level = payload.level ?? current.level;
  const minPoint = payload.minPoint ?? current.minPoint;
  const isActive = payload.isActive ?? current.isActive;

  if (level === 1 && minPoint !== 0) {
    throw new MembershipRankingServiceError('Level 1 membership ranking must start at 0 points', 400);
  }

  if (minPoint === 0 && isActive === false) {
    throw new MembershipRankingServiceError('Base membership ranking cannot be deactivated', 409);
  }
};

const assertUniqueMinPoint = async (
  payload: PartialMembershipRanking,
  currentId?: string,
) => {
  if (payload.minPoint === undefined) {
    return;
  }

  const existingMinPoint = await MembershipRanking.findOne({ minPoint: payload.minPoint });
  if (existingMinPoint && existingMinPoint._id.toString() !== currentId) {
    throw new MembershipRankingServiceError('Membership ranking minPoint already exists', 409);
  }
};

const assertPointOrder = async (
  candidate: { _id?: unknown; level: number; minPoint: number },
  currentId?: string,
) => {
  const rankings = await MembershipRanking.find()
    .select('_id level minPoint')
    .lean();
  const orderedRankings = [
    ...rankings.filter((ranking) => ranking._id.toString() !== currentId),
    candidate,
  ].sort((left, right) => left.level - right.level);

  for (let index = 1; index < orderedRankings.length; index += 1) {
    if (orderedRankings[index].minPoint <= orderedRankings[index - 1].minPoint) {
      throw new MembershipRankingServiceError('Membership ranking minPoint must increase with level', 409);
    }
  }
};

const countTierMembers = async (current: { minPoint: number }) => {
  const nextActiveTier = await MembershipRanking.findOne({
    isActive: true,
    minPoint: { $gt: current.minPoint },
  }).sort({ minPoint: 1 }).select('minPoint').lean();
  const loyaltyPointFilter: Record<string, unknown> = { $gte: current.minPoint };
  if (nextActiveTier) {
    loyaltyPointFilter.$lt = nextActiveTier.minPoint;
  }

  return User.countDocuments({ loyaltyPoint: loyaltyPointFilter });
};

const assertTierCanBeDeactivated = async (
  current: { minPoint: number; isActive: boolean },
  payload: PartialMembershipRanking,
) => {
  if (!current.isActive || payload.isActive !== false) {
    return;
  }

  const memberCount = await countTierMembers(current);
  if (memberCount > 0) {
    throw new MembershipRankingServiceError(
      `Membership ranking has ${memberCount} active member(s) and cannot be deactivated`,
      409,
    );
  }
};

const listMembershipRankings = async () => {
  const rankings = await MembershipRanking.find().sort({ level: 1 }).lean();
  const memberCounts = await Promise.all(rankings.map((ranking, index) => {
    const loyaltyPointFilter: Record<string, unknown> = { $gte: ranking.minPoint };
    if (rankings[index + 1]) {
      loyaltyPointFilter.$lt = rankings[index + 1].minPoint;
    }
    return User.countDocuments({ loyaltyPoint: loyaltyPointFilter });
  }));

  return rankings.map((ranking, index) => ({
    ...ranking,
    maxPoint: rankings[index + 1] ? rankings[index + 1].minPoint - 1 : null,
    memberCount: memberCounts[index],
    ...resolveMembershipVisualConfig(ranking),
  }));
};

const createMembershipRanking = async (payload: MembershipRankingPayload) => {
  const normalized = normalizePayload(payload, 'create');
  assertBaseTierStartsAtZero(
    { level: normalized.level, minPoint: normalized.minPoint, isActive: normalized.isActive },
    normalized,
  );
  await assertUniqueNameAndLevel(normalized);
  await assertUniqueMinPoint(normalized);
  await assertPointOrder(normalized);

  return MembershipRanking.create(normalized);
};

const updateMembershipRanking = async (id: string, payload: MembershipRankingPayload) => {
  assertValidId(id);

  const current = await MembershipRanking.findById(id);
  if (!current) {
    throw new MembershipRankingServiceError('Membership ranking not found', 404);
  }

  const normalized = normalizePayload(payload, 'update');
  assertValidPointRangeForUpdate(current, normalized);
  assertBaseTierStartsAtZero(current, normalized);
  await assertTierCanBeDeactivated(current, normalized);
  await assertUniqueNameAndLevel(normalized, id);
  await assertUniqueMinPoint(normalized, id);
  await assertPointOrder(
    {
      _id: current._id,
      level: normalized.level ?? current.level,
      minPoint: normalized.minPoint ?? current.minPoint,
    },
    id,
  );

  const updatedRanking = await MembershipRanking.findByIdAndUpdate(id, normalized, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();

  return updatedRanking
    ? {
        ...updatedRanking,
        ...resolveMembershipVisualConfig(updatedRanking),
      }
    : updatedRanking;
};

const updateMembershipRankingStatus = async (id: string, isActive: unknown) => {
  return updateMembershipRanking(id, { isActive });
};

const deleteMembershipRanking = async (id: string) => {
  assertValidId(id);
  const current = await MembershipRanking.findById(id);
  if (!current) {
    throw new MembershipRankingServiceError('Membership ranking not found', 404);
  }

  if (current.minPoint === 0) {
    throw new MembershipRankingServiceError('Base membership ranking cannot be deleted', 409);
  }

  const memberCount = await countTierMembers(current);
  if (memberCount > 0) {
    throw new MembershipRankingServiceError(
      `Membership ranking has ${memberCount} active member(s) and cannot be deleted`,
      409,
    );
  }

  const couponCount = await Coupon.countDocuments({
    deletedAt: null,
    eligibleMembershipRanks: current._id,
  });
  if (couponCount > 0) {
    throw new MembershipRankingServiceError(
      `Membership ranking is referenced by ${couponCount} coupon(s) and cannot be deleted`,
      409,
    );
  }

  return MembershipRanking.findByIdAndDelete(id);
};

const listLoyaltyUsers = async (query: LoyaltyPointQuery) => {
  const keyword = firstString(query.keyword)?.slice(0, 80);
  const tierId = firstString(query.tierId);
  const page = parsePositiveInteger(query.page, 1, 10000);
  const limit = parsePositiveInteger(query.limit, 10, 50);
  const filter: Record<string, unknown> = { role: 'user' };

  if (tierId) {
    assertValidId(tierId);
    const tier = await MembershipRanking.findById(tierId).select('minPoint').lean();
    if (!tier) {
      throw new MembershipRankingServiceError('Membership ranking not found', 404);
    }

    const nextTier = await MembershipRanking.findOne({ minPoint: { $gt: tier.minPoint } })
      .sort({ minPoint: 1 })
      .select('minPoint')
      .lean();
    const loyaltyPointFilter: Record<string, unknown> = { $gte: tier.minPoint };
    if (nextTier) {
      loyaltyPointFilter.$lt = nextTier.minPoint;
    }
    filter.loyaltyPoint = loyaltyPointFilter;
  }

  if (keyword) {
    const escapedKeyword = escapeRegex(keyword);
    filter.$or = [
      { name: { $regex: escapedKeyword, $options: 'i' } },
      { email: { $regex: escapedKeyword, $options: 'i' } },
      { phone: { $regex: escapedKeyword, $options: 'i' } },
    ];
  }

  const [items, totalItems] = await Promise.all([
    User.find(filter)
      .select('_id name email phone loyaltyPoint isActive')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const listLoyaltyPointHistory = async (query: LoyaltyPointQuery) => {
  const userId = firstString(query.userId);
  const page = parsePositiveInteger(query.page, 1, 10000);
  const limit = parsePositiveInteger(query.limit, 10, 50);
  const filter: Record<string, unknown> = {};

  if (userId) {
    assertValidId(userId);
    filter.userId = new Types.ObjectId(userId);
  }

  const [items, totalItems] = await Promise.all([
    LoyaltyPointHistory.find(filter)
      .populate('userId', 'name email')
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LoyaltyPointHistory.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const adjustLoyaltyPoints = async (
  payload: LoyaltyPointAdjustmentPayload,
  actor: LoyaltyPointAdjustmentActor,
) => {
  const userId = parseString(payload.userId, 'userId', true) as string;
  const delta = parseNumber(payload.delta, 'delta', true) as number;
  const reason = parseString(payload.reason, 'reason', true) as string;

  assertValidId(userId);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000) {
    throw new MembershipRankingServiceError(
      'delta must be a non-zero integer from -1000000 to 1000000',
      400,
    );
  }
  if (reason.length < 2 || reason.length > 200) {
    throw new MembershipRankingServiceError('reason must be from 2 to 200 characters', 400);
  }

  const session = await mongoose.startSession();
  let result: {
    user: { _id: unknown; name: string; email: string; loyaltyPoint: number };
    history: unknown;
    balanceBefore: number;
    balanceAfter: number;
  } | null = null;

  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: userId, role: 'user' }).session(session);
      if (!user) {
        throw new MembershipRankingServiceError('Loyalty user not found', 404);
      }

      const balanceBefore = Math.max(0, Number(user.loyaltyPoint) || 0);
      const balanceAfter = balanceBefore + delta;
      if (balanceAfter < 0) {
        throw new MembershipRankingServiceError(
          `Cannot subtract more than the current balance of ${balanceBefore} points`,
          409,
        );
      }

      user.loyaltyPoint = balanceAfter;
      user.membershipUpdatedAt = new Date();
      await user.save({ session });

      const [history] = await LoyaltyPointHistory.create([
        {
          userId: user._id,
          type: 'adjust',
          delta,
          balanceAfter,
          reason,
          actorId: actor.actorId && Types.ObjectId.isValid(actor.actorId)
            ? new Types.ObjectId(actor.actorId)
            : null,
          actorRole: actor.actorRole,
        },
      ], { session });

      result = {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          loyaltyPoint: user.loyaltyPoint,
        },
        history,
        balanceBefore,
        balanceAfter,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new MembershipRankingServiceError('Loyalty point adjustment was not committed', 500);
  }

  return result;
};

export const membershipRankingAdminService = {
  listMembershipRankings,
  createMembershipRanking,
  updateMembershipRanking,
  updateMembershipRankingStatus,
  deleteMembershipRanking,
  listLoyaltyUsers,
  listLoyaltyPointHistory,
  adjustLoyaltyPoints,
};
