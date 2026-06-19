import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../../utils/response';
import { promotionAnalyticsService } from './promotion-analytics.service';

export const getPromotionAnalytics = async (req: Request, res: Response) => {
  try { return ok(res, await promotionAnalyticsService.getPromotionAnalytics(req.query)); }
  catch (error) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode: number }).statusCode)
      : 500;
    return errorResponse(res, error instanceof Error ? error.message : 'Analytics request failed', statusCode);
  }
};
