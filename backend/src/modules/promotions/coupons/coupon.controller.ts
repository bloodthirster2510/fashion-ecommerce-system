import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../../utils/response';
import { CouponServiceError, couponService } from './coupon.service';
import { PromotionPricingError } from '../pricing/promotion-pricing.service';
import type {
  AvailableCouponsInput,
  CouponListQueryInput,
  CouponUsageListQueryInput,
  CreateCouponInput,
  UpdateCouponInput,
  ValidateCouponInput,
} from './coupon.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof CouponServiceError || e instanceof PromotionPricingError || hasStatusCode(e)) {
    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  return {
    statusCode: 500,
    message: e instanceof Error ? e.message : 'An error occurred',
  };
};

const parseString = (value: unknown) => {
  if (Array.isArray(value)) {
    return parseString(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new CouponServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parseCouponListQuery = (req: Request): CouponListQueryInput => {
  const status = parseString(req.query.status);
  const sort = parseString(req.query.sort);
  const allowedStatuses = ['active', 'inactive', 'expired', 'upcoming'];
  const allowedSorts = ['created_desc', 'created_asc', 'end_asc', 'usage_desc', 'code_asc'];

  if (status && !allowedStatuses.includes(status)) {
    throw new CouponServiceError('Invalid status', 400);
  }

  if (sort && !allowedSorts.includes(sort)) {
    throw new CouponServiceError('Invalid sort', 400);
  }

  return {
    status: status as CouponListQueryInput['status'],
    sort: sort as CouponListQueryInput['sort'],
    keyword: parseString(req.query.keyword),
    page: parsePositiveInteger(req.query.page, 'page'),
    limit: parsePositiveInteger(req.query.limit, 'limit'),
  };
};

const getActorId = (req: Request) => req.user?.userId;

const validateCoupon = async (req: Request, res: Response) => {
  try {
    const input = req.body as ValidateCouponInput;

    if (!input.couponCode || !input.cartItemIds?.length) {
      return errorResponse(res, 'couponCode and cartItemIds are required', 400);
    }

    const result = await couponService.validateCoupon(req.user!.userId, input);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const listAvailableCoupons = async (req: Request, res: Response) => {
  try {
    const input = req.body as AvailableCouponsInput;
    const result = await couponService.listAvailableCoupons(req.user!.userId, input);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const listCoupons = async (req: Request, res: Response) => {
  try {
    const result = await couponService.listCoupons(parseCouponListQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getCouponById = async (req: Request, res: Response) => {
  try {
    const result = await couponService.getCouponById(req.params.id as string);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const checkCouponCodeAvailability = async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;
    const result = await couponService.checkCouponCodeAvailability(code, excludeId);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const listCouponUsage = async (req: Request, res: Response) => {
  try {
    const query: CouponUsageListQueryInput = {
      page: parsePositiveInteger(req.query.page, 'page'),
      limit: parsePositiveInteger(req.query.limit, 'limit'),
    };
    const result = await couponService.listCouponUsage(req.params.id as string, query);
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const createCoupon = async (req: Request, res: Response) => {
  try {
    const coupon = await couponService.createCoupon(req.body as CreateCouponInput, getActorId(req));
    return created(res, coupon);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateCoupon = async (req: Request, res: Response) => {
  try {
    const coupon = await couponService.updateCoupon(
      req.params.id as string,
      req.body as UpdateCouponInput,
      getActorId(req),
    );
    return ok(res, coupon);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateCouponStatus = async (req: Request, res: Response) => {
  try {
    if (typeof req.body?.isActive !== 'boolean') {
      return errorResponse(res, 'isActive must be a boolean', 400);
    }

    const coupon = await couponService.updateCouponStatus(
      req.params.id as string,
      req.body.isActive,
      getActorId(req),
    );
    return ok(res, coupon);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const coupon = await couponService.deleteCoupon(req.params.id as string, getActorId(req));
    return ok(res, coupon);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  createCoupon,
  checkCouponCodeAvailability,
  deleteCoupon,
  getCouponById,
  listCouponUsage,
  listAvailableCoupons,
  listCoupons,
  updateCoupon,
  updateCouponStatus,
  validateCoupon,
};
