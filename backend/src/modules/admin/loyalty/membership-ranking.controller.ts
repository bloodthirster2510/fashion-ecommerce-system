import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../../utils/response';
import {
  MembershipRankingServiceError,
  membershipRankingAdminService,
  type MembershipRankingPayload,
} from './membership-ranking.service';

const getErrorResponse = (error: unknown) => {
  if (error instanceof MembershipRankingServiceError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return {
    statusCode: 500,
    message: error instanceof Error ? error.message : 'An error occurred',
  };
};

const getParamId = (req: Request) => {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
};

export const listMembershipRankings = async (_req: Request, res: Response) => {
  try {
    const rankings = await membershipRankingAdminService.listMembershipRankings();

    return ok(res, rankings);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const createMembershipRanking = async (req: Request, res: Response) => {
  try {
    const ranking = await membershipRankingAdminService.createMembershipRanking(
      req.body as MembershipRankingPayload,
    );

    return created(res, ranking);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const updateMembershipRanking = async (req: Request, res: Response) => {
  try {
    const ranking = await membershipRankingAdminService.updateMembershipRanking(
      getParamId(req),
      req.body as MembershipRankingPayload,
    );

    return ok(res, ranking);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const updateMembershipRankingStatus = async (req: Request, res: Response) => {
  try {
    const ranking = await membershipRankingAdminService.updateMembershipRankingStatus(
      getParamId(req),
      req.body.isActive,
    );

    return ok(res, ranking);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const deleteMembershipRanking = async (req: Request, res: Response) => {
  try {
    const ranking = await membershipRankingAdminService.deleteMembershipRanking(getParamId(req));

    return ok(res, ranking);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};
