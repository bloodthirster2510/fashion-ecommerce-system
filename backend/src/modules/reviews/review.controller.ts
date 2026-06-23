import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import { REVIEW_MODERATION_RULES, ReviewServiceError, reviewService } from './review.service';
import type { AdminReviewListQueryInput, CreateReviewInput, ReviewListQueryInput, ReviewModerationStatus, UpdateReviewInput } from './review.types';

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ReviewServiceError) return errorResponse(res, error.message, error.statusCode);
  console.error('Review controller error:', error);
  return errorResponse(res, 'Internal Server Error', 500);
};

const parseInteger = (value: unknown, field: string, min: number, max?: number) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    throw new ReviewServiceError(`${field} must be an integer between ${min} and ${max ?? 'unlimited'}`, 400);
  }
  return parsed;
};

const parseQuery = (req: Request): ReviewListQueryInput => {
  const sort = req.query.sort as ReviewListQueryInput['sort'];
  const allowedSorts = ['newest', 'oldest', 'rating_desc', 'rating_asc'];
  if (sort && !allowedSorts.includes(sort)) throw new ReviewServiceError('Invalid sort', 400);
  return {
    page: parseInteger(req.query.page, 'page', 1),
    limit: parseInteger(req.query.limit, 'limit', 1, 100),
    rating: parseInteger(req.query.rating, 'rating', 1, 5),
    sort,
  };
};

const validateReviewInput = (body: Partial<CreateReviewInput>, partial = false) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ReviewServiceError('Request body must be an object', 400);
  }
  // Khi cập nhật (partial=true), chỉ kiểm tra những trường client thực sự gửi lên.
  // Khi tạo mới, productId, rating và comment đều bắt buộc.
  if (!partial && !body.productId) throw new ReviewServiceError('productId is required', 400);
  if (!partial || body.rating !== undefined) parseInteger(body.rating, 'rating', 1, 5);
  if (!partial || body.comment !== undefined) {
    if (typeof body.comment !== 'string' || !body.comment.trim()) {
      throw new ReviewServiceError('comment is required', 400);
    }
    if (body.comment.trim().length > 2000) throw new ReviewServiceError('comment must not exceed 2000 characters', 400);
  }
};

export const listProductReviews = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.listProductReviews(req.params.productId as string, parseQuery(req))); }
  catch (error) { return handleError(res, error); }
};

export const listMyReviews = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.listMyReviews(req.user!.userId, parseQuery(req))); }
  catch (error) { return handleError(res, error); }
};

export const getReviewEligibility = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.getEligibility(req.user!.userId, req.params.productId as string)); }
  catch (error) { return handleError(res, error); }
};

export const createReview = async (req: Request, res: Response) => {
  try {
    validateReviewInput(req.body);
    return created(res, await reviewService.createReview(req.user!.userId, req.body as CreateReviewInput));
  } catch (error) { return handleError(res, error); }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateReviewInput;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ReviewServiceError('Request body must be an object', 400);
    }
    if (input.rating === undefined && input.comment === undefined) throw new ReviewServiceError('No data to update', 400);
    validateReviewInput(input, true);
    return ok(res, await reviewService.updateReview(req.user!.userId, req.params.id as string, input));
  } catch (error) { return handleError(res, error); }
};

export const deleteReview = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.deleteReview(req.user!.userId, req.params.id as string)); }
  catch (error) { return handleError(res, error); }
};

export const listAdminReviews = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as ReviewModerationStatus | undefined;
    if (status && !['pending', 'visible', 'hidden'].includes(status)) {
      throw new ReviewServiceError('Invalid moderation status', 400);
    }
    const period = req.query.period as AdminReviewListQueryInput['period'];
    if (period && !['today', 'week', 'month'].includes(period)) {
      throw new ReviewServiceError('Invalid period', 400);
    }
    const hasImagesValue = req.query.hasImages;
    if (hasImagesValue !== undefined && hasImagesValue !== 'true' && hasImagesValue !== 'false') {
      throw new ReviewServiceError('hasImages must be true or false', 400);
    }
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined;
    if (keyword && keyword.length > 100) throw new ReviewServiceError('keyword must not exceed 100 characters', 400);
    const hasImages = hasImagesValue === undefined ? undefined : hasImagesValue === 'true';
    return ok(res, await reviewService.listAdminReviews({
      page: parseInteger(req.query.page, 'page', 1),
      limit: parseInteger(req.query.limit, 'limit', 1, 100),
      keyword,
      rating: parseInteger(req.query.rating, 'rating', 1, 5),
      status,
      productId: typeof req.query.productId === 'string' ? req.query.productId : undefined,
      period,
      hasImages,
    }));
  } catch (error) { return handleError(res, error); }
};

export const getModerationRules = async (_req: Request, res: Response) => ok(res, REVIEW_MODERATION_RULES);

export const updateModerationStatus = async (req: Request, res: Response) => {
  try {
    const status = req.body?.status as ReviewModerationStatus;
    if (!['pending', 'visible', 'hidden'].includes(status)) {
      throw new ReviewServiceError('Invalid moderation status', 400);
    }
    return ok(res, await reviewService.updateModerationStatus(req.params.id as string, status));
  } catch (error) { return handleError(res, error); }
};

export const updateManyModerationStatuses = async (req: Request, res: Response) => {
  try {
    const status = req.body?.status as ReviewModerationStatus;
    const reviewIds = req.body?.reviewIds;
    if (!['visible', 'hidden'].includes(status)) {
      throw new ReviewServiceError('Invalid moderation status', 400);
    }
    if (!Array.isArray(reviewIds) || reviewIds.some((id) => typeof id !== 'string')) {
      throw new ReviewServiceError('reviewIds must be an array of strings', 400);
    }
    return ok(res, await reviewService.updateManyModerationStatuses(reviewIds, status));
  } catch (error) { return handleError(res, error); }
};

export const replyToReview = async (req: Request, res: Response) => {
  try {
    const reply = req.body?.reply;
    if (typeof reply !== 'string' || !reply.trim()) throw new ReviewServiceError('Reply is required', 400);
    if (reply.trim().length > 2000) throw new ReviewServiceError('Reply must not exceed 2000 characters', 400);
    return ok(res, await reviewService.replyToReview(req.params.id as string, req.user!.userId, reply));
  } catch (error) { return handleError(res, error); }
};
