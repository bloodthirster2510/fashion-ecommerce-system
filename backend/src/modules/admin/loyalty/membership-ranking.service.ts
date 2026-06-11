import { Types } from 'mongoose';
import { MembershipRanking } from '../../../database/models/membership-ranking.model';
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

type NormalizedMembershipRanking = {
  name: string;
  level: number;
  minPoint: number;
  maxPoint: number | null;
  discountPercent: number;
  benefitDescription?: string;
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

const normalizePayload = (payload: MembershipRankingPayload, mode: 'create' | 'update') => {
  const required = mode === 'create';
  const normalized: PartialMembershipRanking = {};
  const name = parseString(payload.name, 'name', required);
  const level = parseNumber(payload.level, 'level', required);
  const minPoint = parseNumber(payload.minPoint, 'minPoint', required);
  const maxPoint = payload.maxPoint === null ? null : parseNumber(payload.maxPoint, 'maxPoint', false);
  const discountPercent = parseNumber(payload.discountPercent, 'discountPercent', required);
  const benefitDescription = parseString(payload.benefitDescription, 'benefitDescription', false);
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
};

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

const listMembershipRankings = () => {
  return MembershipRanking.find()
    .sort({ level: 1 })
    .lean()
    .then((rankings) =>
      rankings.map((ranking) => ({
        ...ranking,
        ...resolveMembershipVisualConfig(ranking),
      })),
    );
};

const createMembershipRanking = async (payload: MembershipRankingPayload) => {
  const normalized = normalizePayload(payload, 'create');
  await assertUniqueNameAndLevel(normalized);

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
  await assertUniqueNameAndLevel(normalized, id);

  const updatedRanking = await MembershipRanking.findByIdAndUpdate(id, normalized, {
    new: true,
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
  return updateMembershipRanking(id, { isActive: false });
};

export const membershipRankingAdminService = {
  listMembershipRankings,
  createMembershipRanking,
  updateMembershipRanking,
  updateMembershipRankingStatus,
  deleteMembershipRanking,
};
