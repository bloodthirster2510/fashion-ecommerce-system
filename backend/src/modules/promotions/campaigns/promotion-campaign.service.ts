import { Types } from 'mongoose';
import { Coupon, PromotionCampaign } from '../../../database/models';

export type PromotionCampaignPayload = {
  code?: unknown;
  name?: unknown;
  description?: unknown;
  couponIds?: unknown;
  allowCouponStacking?: unknown;
  maxCouponsPerOrder?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  isActive?: unknown;
};

export class PromotionCampaignServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'PromotionCampaignServiceError';
  }
}

const parseString = (value: unknown, field: string, required = false) => {
  if (value === undefined || value === null) {
    if (required) throw new PromotionCampaignServiceError(`${field} is required`, 400);
    return undefined;
  }
  if (typeof value !== 'string') throw new PromotionCampaignServiceError(`${field} must be a string`, 400);
  const normalized = value.trim();
  if (required && !normalized) throw new PromotionCampaignServiceError(`${field} is required`, 400);
  return normalized || undefined;
};

const parseDate = (value: unknown, field: string, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new PromotionCampaignServiceError(`${field} is required`, 400);
    return undefined;
  }
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) throw new PromotionCampaignServiceError(`${field} is invalid`, 400);
  return date;
};

const normalizePayload = (payload: PromotionCampaignPayload, mode: 'create' | 'update') => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new PromotionCampaignServiceError('Campaign payload must be an object', 400);
  }
  const required = mode === 'create';
  const data: Record<string, unknown> = {};
  const code = parseString(payload.code, 'code', required)?.toUpperCase();
  const name = parseString(payload.name, 'name', required);
  const description = parseString(payload.description, 'description');
  const startAt = parseDate(payload.startAt, 'startAt', required);
  const endAt = parseDate(payload.endAt, 'endAt', required);

  if (code !== undefined) {
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new PromotionCampaignServiceError('Invalid campaign code', 400);
    data.code = code;
  }
  if (name !== undefined) data.name = name;
  if (description !== undefined || payload.description === null) data.description = description ?? null;
  if (startAt) data.startAt = startAt;
  if (endAt) data.endAt = endAt;
  if (startAt && endAt && endAt <= startAt) {
    throw new PromotionCampaignServiceError('endAt must be after startAt', 400);
  }

  if (payload.couponIds !== undefined) {
    if (!Array.isArray(payload.couponIds) || payload.couponIds.length < 1 || payload.couponIds.length > 100) {
      throw new PromotionCampaignServiceError('couponIds must include from 1 to 100 coupons', 400);
    }
    const uniqueIds = Array.from(new Set(payload.couponIds.map(String)));
    if (uniqueIds.some((id) => !Types.ObjectId.isValid(id))) {
      throw new PromotionCampaignServiceError('Invalid coupon id', 400);
    }
    data.couponIds = uniqueIds.map((id) => new Types.ObjectId(id));
  } else if (required) {
    throw new PromotionCampaignServiceError('couponIds is required', 400);
  }

  if (payload.allowCouponStacking !== undefined) {
    if (typeof payload.allowCouponStacking !== 'boolean') {
      throw new PromotionCampaignServiceError('allowCouponStacking must be a boolean', 400);
    }
    data.allowCouponStacking = payload.allowCouponStacking;
  } else if (required) {
    data.allowCouponStacking = false;
  }

  if (payload.maxCouponsPerOrder !== undefined) {
    const limit = Number(payload.maxCouponsPerOrder);
    if (!Number.isInteger(limit) || limit < 1 || limit > 3) {
      throw new PromotionCampaignServiceError('maxCouponsPerOrder must be from 1 to 3', 400);
    }
    data.maxCouponsPerOrder = limit;
  } else if (required) {
    data.maxCouponsPerOrder = data.allowCouponStacking ? 2 : 1;
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') throw new PromotionCampaignServiceError('isActive must be a boolean', 400);
    data.isActive = payload.isActive;
  } else if (required) {
    data.isActive = true;
  }

  const stacking = data.allowCouponStacking as boolean | undefined;
  const limit = data.maxCouponsPerOrder as number | undefined;
  if (stacking === false && limit !== undefined && limit !== 1) {
    throw new PromotionCampaignServiceError('Non-stacking campaign must allow exactly 1 coupon', 400);
  }
  if (stacking === true && limit !== undefined && limit < 2) {
    throw new PromotionCampaignServiceError('Stacking campaign must allow at least 2 coupons', 400);
  }

  return data;
};

const assertCouponsExist = async (couponIds?: unknown) => {
  if (!Array.isArray(couponIds)) return;
  const count = await Coupon.countDocuments({ _id: { $in: couponIds }, deletedAt: null });
  if (count !== couponIds.length) throw new PromotionCampaignServiceError('One or more coupons do not exist', 400);
};

const listCampaigns = async () => PromotionCampaign.find()
  .populate('couponIds', 'code name isActive startAt endAt')
  .sort({ createdAt: -1 })
  .lean();

const createCampaign = async (payload: PromotionCampaignPayload, actorId?: string) => {
  const data = normalizePayload(payload, 'create');
  await assertCouponsExist(data.couponIds);
  if (actorId && Types.ObjectId.isValid(actorId)) {
    data.createdBy = new Types.ObjectId(actorId);
    data.updatedBy = new Types.ObjectId(actorId);
  }
  try {
    return await PromotionCampaign.create(data);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new PromotionCampaignServiceError('Campaign code already exists', 409);
    }
    throw error;
  }
};

const updateCampaign = async (id: string, payload: PromotionCampaignPayload, actorId?: string) => {
  if (!Types.ObjectId.isValid(id)) throw new PromotionCampaignServiceError('Invalid campaign id', 400);
  const current = await PromotionCampaign.findById(id);
  if (!current) throw new PromotionCampaignServiceError('Campaign not found', 404);
  const data = normalizePayload(payload, 'update');
  await assertCouponsExist(data.couponIds);

  const startAt = data.startAt as Date | undefined ?? current.startAt;
  const endAt = data.endAt as Date | undefined ?? current.endAt;
  if (endAt <= startAt) throw new PromotionCampaignServiceError('endAt must be after startAt', 400);
  const stacking = data.allowCouponStacking as boolean | undefined ?? current.allowCouponStacking;
  const limit = data.maxCouponsPerOrder as number | undefined ?? current.maxCouponsPerOrder;
  if ((!stacking && limit !== 1) || (stacking && limit < 2)) {
    throw new PromotionCampaignServiceError('Campaign stacking configuration is inconsistent', 400);
  }
  if (actorId && Types.ObjectId.isValid(actorId)) data.updatedBy = new Types.ObjectId(actorId);

  try {
    const campaign = await PromotionCampaign.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    );
    if (!campaign) throw new PromotionCampaignServiceError('Campaign not found', 404);
    return campaign;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new PromotionCampaignServiceError('Campaign code already exists', 409);
    }
    throw error;
  }
};

const deleteCampaign = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new PromotionCampaignServiceError('Invalid campaign id', 400);
  const campaign = await PromotionCampaign.findByIdAndDelete(id);
  if (!campaign) throw new PromotionCampaignServiceError('Campaign not found', 404);
  return campaign;
};

const findStackingCampaignForCoupons = async (couponIds: Types.ObjectId[], now = new Date()) => {
  if (couponIds.length < 2) return null;
  return PromotionCampaign.findOne({
    couponIds: { $all: couponIds },
    allowCouponStacking: true,
    maxCouponsPerOrder: { $gte: couponIds.length },
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
  });
};

export const promotionCampaignService = {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  findStackingCampaignForCoupons,
};
