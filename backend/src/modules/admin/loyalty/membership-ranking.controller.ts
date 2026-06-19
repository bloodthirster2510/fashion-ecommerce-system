import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../../utils/response';
import { auditLogService } from '../../audit-logs/audit-log.service';
import {
  MembershipRankingServiceError,
  membershipRankingAdminService,
  type LoyaltyPointAdjustmentPayload,
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

const getAuditActorRole = (req: Request) => req.user?.role === 'admin' ? 'admin' : 'staff';

const toAuditSnapshot = (ranking: unknown) => {
  if (ranking && typeof ranking === 'object' && 'toObject' in ranking) {
    return (ranking as { toObject(): Record<string, unknown> }).toObject();
  }

  return ranking as Record<string, unknown>;
};

const recordRankingAudit = async (
  req: Request,
  action: 'membership_ranking.create' | 'membership_ranking.update' | 'membership_ranking.status_update' | 'membership_ranking.delete',
  ranking: { _id: unknown },
) => {
  await auditLogService.recordAuditLogBestEffort({
    actorId: req.user?.userId ?? null,
    actorRole: getAuditActorRole(req),
    action,
    targetType: 'MembershipRanking',
    targetId: String(ranking._id),
    after: toAuditSnapshot(ranking),
  });
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

export const listLoyaltyUsers = async (req: Request, res: Response) => {
  try {
    return ok(res, await membershipRankingAdminService.listLoyaltyUsers(req.query));
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const listLoyaltyPointHistory = async (req: Request, res: Response) => {
  try {
    return ok(res, await membershipRankingAdminService.listLoyaltyPointHistory(req.query));
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const adjustLoyaltyPoints = async (req: Request, res: Response) => {
  try {
    const result = await membershipRankingAdminService.adjustLoyaltyPoints(
      req.body as LoyaltyPointAdjustmentPayload,
      {
        actorId: req.user?.userId ?? null,
        actorRole: getAuditActorRole(req),
      },
    );

    return created(res, result, 'Loyalty points adjusted');
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
    await recordRankingAudit(req, 'membership_ranking.create', ranking);

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
    if (ranking) {
      await recordRankingAudit(req, 'membership_ranking.update', ranking);
    }

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
    if (ranking) {
      await recordRankingAudit(req, 'membership_ranking.status_update', ranking);
    }

    return ok(res, ranking);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const deleteMembershipRanking = async (req: Request, res: Response) => {
  try {
    const ranking = await membershipRankingAdminService.deleteMembershipRanking(getParamId(req));
    if (ranking) {
      await recordRankingAudit(req, 'membership_ranking.delete', ranking);
    }

    return ok(res, ranking);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};
