import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../../utils/response';
import { LoyaltyRuleServiceError, loyaltyRuleService, type LoyaltyRulePayload } from './loyalty-rule.service';

const handleError = (res: Response, error: unknown) => error instanceof LoyaltyRuleServiceError
  ? errorResponse(res, error.message, error.statusCode)
  : errorResponse(res, error instanceof Error ? error.message : 'Loyalty rule request failed', 500);

export const listLoyaltyRules = async (_req: Request, res: Response) => {
  try { return ok(res, await loyaltyRuleService.listRules()); } catch (error) { return handleError(res, error); }
};
export const createLoyaltyRule = async (req: Request, res: Response) => {
  try { return created(res, await loyaltyRuleService.createRule(req.body as LoyaltyRulePayload, req.user?.userId)); }
  catch (error) { return handleError(res, error); }
};
export const updateLoyaltyRule = async (req: Request, res: Response) => {
  try {
    return ok(res, await loyaltyRuleService.updateRule(
      req.params.ruleId as string,
      req.body as LoyaltyRulePayload,
      req.user?.userId,
    ));
  } catch (error) { return handleError(res, error); }
};
export const deleteLoyaltyRule = async (req: Request, res: Response) => {
  try { return ok(res, await loyaltyRuleService.deleteRule(req.params.ruleId as string)); }
  catch (error) { return handleError(res, error); }
};
