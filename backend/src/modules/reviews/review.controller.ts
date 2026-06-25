import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import { REVIEW_MODERATION_RULES, ReviewServiceError, reviewService } from './review.service';
import type {
  AdminReviewListQueryInput,
  CreateReviewInput,
  EligibleReviewItemsQueryInput,
  ReviewAdminActor,
  ReviewCriteriaInput,
  ReviewListQueryInput,
  ReviewModerationStatus,
  UpdateReviewInput,
} from './review.types';

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
  const allowedSorts = ['newest', 'oldest', 'rating_desc', 'rating_asc', 'helpful'];
  if (sort && !allowedSorts.includes(sort)) throw new ReviewServiceError('Invalid sort', 400);
  return {
    page: parseInteger(req.query.page, 'page', 1),
    limit: parseInteger(req.query.limit, 'limit', 1, 100),
    rating: parseInteger(req.query.rating, 'rating', 1, 5),
    sort,
  };
};

const parseCriteria = (value: unknown): ReviewCriteriaInput | null | undefined => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch {
      throw new ReviewServiceError('criteria must be valid JSON', 400);
    }
    return parseCriteria(parsed);
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ReviewServiceError('criteria must be an object', 400);
  }
  const criteria = value as Record<string, unknown>;
  const allowedKeys = new Set(['productQuality', 'descriptionMatch', 'sizeFit']);
  if (Object.keys(criteria).some((key) => !allowedKeys.has(key))) {
    throw new ReviewServiceError('criteria contains unsupported fields', 400);
  }
  const productQuality = parseInteger(criteria.productQuality, 'criteria.productQuality', 1, 5);
  const descriptionMatch = parseInteger(criteria.descriptionMatch, 'criteria.descriptionMatch', 1, 5);
  const sizeFit = criteria.sizeFit;
  if (sizeFit !== undefined && !['small', 'true_to_size', 'large'].includes(String(sizeFit))) {
    throw new ReviewServiceError('criteria.sizeFit is invalid', 400);
  }
  return {
    ...(productQuality !== undefined ? { productQuality } : {}),
    ...(descriptionMatch !== undefined ? { descriptionMatch } : {}),
    ...(sizeFit !== undefined ? { sizeFit: sizeFit as ReviewCriteriaInput['sizeFit'] } : {}),
  };
};

const getAdminActor = (req: Request): ReviewAdminActor => ({
  userId: req.user!.userId,
  role: req.user!.role as ReviewAdminActor['role'],
});

type ReviewInputBody = {
  orderId?: string;
  orderItemId?: string;
  rating?: number;
  comment?: string;
  criteria?: ReviewCriteriaInput | null;
  keepImageIds?: string[];
};

const validateReviewInput = (body: ReviewInputBody, partial = false) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ReviewServiceError('Request body must be an object', 400);
  }
  // Khi cập nhật (partial=true), chỉ kiểm tra những trường client thực sự gửi lên.
  // Khi tạo mới, orderId/orderItemId/rating/comment đều bắt buộc.
  if (!partial && !body.orderId) throw new ReviewServiceError('orderId is required', 400);
  if (!partial && !body.orderItemId) throw new ReviewServiceError('orderItemId is required', 400);
  if (!partial || body.rating !== undefined) {
    body.rating = parseInteger(body.rating, 'rating', 1, 5);
  }
  if (!partial || body.comment !== undefined) {
    if (typeof body.comment !== 'string' || !body.comment.trim()) {
      throw new ReviewServiceError('comment is required', 400);
    }
    const commentLength = body.comment.trim().length;
    if (commentLength < 10 || commentLength > 2000) {
      throw new ReviewServiceError('comment must contain between 10 and 2000 characters', 400);
    }
  }
  if (body.criteria !== undefined) body.criteria = parseCriteria(body.criteria);
};

const parseStringArray = (value: unknown, field: string) => {
  if (value === undefined) return undefined;
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); }
    catch { throw new ReviewServiceError(`${field} must be valid JSON`, 400); }
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new ReviewServiceError(`${field} must be an array of strings`, 400);
  }
  return [...new Set(parsed)];
};

const getReviewFiles = (req: Request) =>
  (req.files as Express.Multer.File[] | undefined) ?? [];

export const listProductReviews = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.listProductReviews(req.params.productId as string, parseQuery(req))); }
  catch (error) { return handleError(res, error); }
};

export const listMyReviews = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.listMyReviews(req.user!.userId, parseQuery(req))); }
  catch (error) { return handleError(res, error); }
};

export const getReviewEligibility = async (req: Request, res: Response) => {
  try {
    const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : '';
    const orderItemId = typeof req.query.orderItemId === 'string' ? req.query.orderItemId : '';
    if (!orderId) throw new ReviewServiceError('orderId is required', 400);
    if (!orderItemId) throw new ReviewServiceError('orderItemId is required', 400);
    return ok(res, await reviewService.getEligibility(req.user!.userId, orderId, orderItemId));
  }
  catch (error) { return handleError(res, error); }
};

export const listEligibleReviewItems = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as EligibleReviewItemsQueryInput['status'];
    if (status && !['eligible', 'reviewed', 'all'].includes(status)) {
      throw new ReviewServiceError('Invalid eligibility status', 400);
    }
    return ok(res, await reviewService.listEligibleItems(req.user!.userId, {
      page: parseInteger(req.query.page, 'page', 1),
      limit: parseInteger(req.query.limit, 'limit', 1, 100),
      status,
      productId: typeof req.query.productId === 'string' ? req.query.productId : undefined,
    }));
  } catch (error) { return handleError(res, error); }
};

export const createReview = async (req: Request, res: Response) => {
  try {
    validateReviewInput(req.body);
    return created(res, await reviewService.createReview(
      req.user!.userId,
      req.body as CreateReviewInput,
      getReviewFiles(req),
    ));
  } catch (error) { return handleError(res, error); }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateReviewInput;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ReviewServiceError('Request body must be an object', 400);
    }
    input.keepImageIds = parseStringArray(req.body.keepImageIds, 'keepImageIds');
    if (
      input.rating === undefined &&
      input.comment === undefined &&
      input.criteria === undefined &&
      input.keepImageIds === undefined &&
      getReviewFiles(req).length === 0
    ) {
      throw new ReviewServiceError('No data to update', 400);
    }
    validateReviewInput(input, true);
    return ok(res, await reviewService.updateReview(
      req.user!.userId,
      req.params.id as string,
      input,
      getReviewFiles(req),
    ));
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
    // Keyword được trim và giới hạn độ dài trước khi tạo RegExp ở service.
    // Việc này giữ API trả 400 rõ ràng thay vì để truy vấn nặng bất thường.
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
    if (!['visible', 'hidden'].includes(status)) {
      throw new ReviewServiceError('Invalid moderation status', 400);
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    return ok(res, await reviewService.updateModerationStatus(
      req.params.id as string,
      status,
      getAdminActor(req),
      reason,
    ));
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
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    return ok(res, await reviewService.updateManyModerationStatuses(
      reviewIds,
      status,
      getAdminActor(req),
      reason,
    ));
  } catch (error) { return handleError(res, error); }
};

export const replyToReview = async (req: Request, res: Response) => {
  try {
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim()) throw new ReviewServiceError('Content is required', 400);
    if (content.trim().length > 2000) throw new ReviewServiceError('Content must not exceed 2000 characters', 400);
    return ok(res, await reviewService.replyToReview(
      req.params.id as string,
      getAdminActor(req),
      content,
    ));
  } catch (error) { return handleError(res, error); }
};

export const getAdminReviewDetail = async (req: Request, res: Response) => {
  try { return ok(res, await reviewService.getAdminReviewDetail(req.params.id as string)); }
  catch (error) { return handleError(res, error); }
};

export const toggleHelpfulVote = async (req: Request, res: Response) => {
  try {
    return ok(res, await reviewService.toggleHelpfulVote(
      req.user!.userId,
      req.params.id as string,
    ));
  } catch (error) { return handleError(res, error); }
};

export const deleteReviewReply = async (req: Request, res: Response) => {
  try {
    return ok(res, await reviewService.deleteReviewReply(req.params.id as string, getAdminActor(req)));
  } catch (error) { return handleError(res, error); }
};
