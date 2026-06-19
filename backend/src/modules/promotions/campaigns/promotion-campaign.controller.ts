import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../../utils/response';
import {
  PromotionCampaignServiceError,
  promotionCampaignService,
  type PromotionCampaignPayload,
} from './promotion-campaign.service';

const handleError = (res: Response, error: unknown) => {
  if (error instanceof PromotionCampaignServiceError) return errorResponse(res, error.message, error.statusCode);
  return errorResponse(res, error instanceof Error ? error.message : 'Campaign request failed', 500);
};

export const listCampaigns = async (_req: Request, res: Response) => {
  try { return ok(res, await promotionCampaignService.listCampaigns()); } catch (error) { return handleError(res, error); }
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    return created(res, await promotionCampaignService.createCampaign(
      req.body as PromotionCampaignPayload,
      req.user?.userId,
    ));
  } catch (error) { return handleError(res, error); }
};

export const updateCampaign = async (req: Request, res: Response) => {
  try {
    return ok(res, await promotionCampaignService.updateCampaign(
      req.params.id as string,
      req.body as PromotionCampaignPayload,
      req.user?.userId,
    ));
  } catch (error) { return handleError(res, error); }
};

export const deleteCampaign = async (req: Request, res: Response) => {
  try { return ok(res, await promotionCampaignService.deleteCampaign(req.params.id as string)); }
  catch (error) { return handleError(res, error); }
};
