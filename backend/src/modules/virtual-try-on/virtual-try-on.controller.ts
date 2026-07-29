import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import { VirtualTryOnSettingsServiceError } from './virtual-try-on-settings.service';
import { VirtualTryOnServiceError, virtualTryOnService } from './virtual-try-on.service';
import type {
  CreateVirtualTryOnJobInput,
  UploadAssetSource,
  ValidateVirtualTryOnAssetInput,
  VirtualTryOnListQuery,
  VirtualTryOnPromptRuleListQuery,
  CreatePromptRuleInput,
  UpdatePromptRuleInput,
  VirtualTryOnAccountLockListQuery,
  LockAccountInput,
} from './virtual-try-on.types';

const handleError = (res: Response, error: unknown) => {
  if (
    error instanceof VirtualTryOnServiceError
    || error instanceof VirtualTryOnSettingsServiceError
  ) {
    return errorResponse(res, error.message, error.statusCode, {
      ...(error instanceof VirtualTryOnServiceError && error.errorCode
        ? { errorCode: error.errorCode }
        : {}),
      ...(error instanceof VirtualTryOnServiceError && error.data !== undefined
        ? { data: error.data }
        : {}),
    });
  }

  console.error('Virtual try-on controller error:', error);
  return errorResponse(res, 'Internal Server Error', 500);
};

const getUserId = (req: Request) => req.user!.userId;
const getAdminActorRole = (req: Request): 'admin' | 'staff' => (
  req.user?.role === 'admin' ? 'admin' : 'staff'
);

const getUploadFile = (req: Request) => req.file as Express.Multer.File | undefined;

const getSource = (value: unknown): UploadAssetSource => (
  value === 'camera' ? 'camera' : 'upload'
);

const getQuery = (req: Request): VirtualTryOnListQuery => ({
  page: req.query.page ? Number(req.query.page) : undefined,
  limit: req.query.limit ? Number(req.query.limit) : undefined,
  status: typeof req.query.status === 'string' ? req.query.status : undefined,
  type: typeof req.query.type === 'string' ? req.query.type : undefined,
});

const getAdminQuery = (req: Request): VirtualTryOnListQuery & {
  provider?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
} => ({
  ...getQuery(req),
  provider: typeof req.query.provider === 'string' ? req.query.provider : undefined,
  keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
  dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
});

const getPromptRuleListQuery = (req: Request): VirtualTryOnPromptRuleListQuery => ({
  page: req.query.page ? Number(req.query.page) : undefined,
  limit: req.query.limit ? Number(req.query.limit) : undefined,
  keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  category: typeof req.query.category === 'string' ? (req.query.category as VirtualTryOnPromptRuleListQuery['category']) : undefined,
  enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
});

const getAccountLockListQuery = (req: Request): VirtualTryOnAccountLockListQuery => ({
  page: req.query.page ? Number(req.query.page) : undefined,
  limit: req.query.limit ? Number(req.query.limit) : undefined,
  keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  locked: req.query.locked === 'true' ? true : req.query.locked === 'false' ? false : undefined,
});

export const uploadAsset = async (req: Request, res: Response) => {
  try {
    const asset = await virtualTryOnService.uploadAsset(
      getUserId(req),
      getUploadFile(req)!,
      getSource(req.body?.source),
    );
    return created(res, asset);
  } catch (error) {
    return handleError(res, error);
  }
};

export const listAssets = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.listAssets(getUserId(req), getQuery(req)));
  } catch (error) {
    return handleError(res, error);
  }
};

export const deleteAsset = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.deleteAsset(getUserId(req), req.params.assetId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const validateAsset = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.validateAsset(
      getUserId(req),
      req.params.assetId as string,
      req.body as ValidateVirtualTryOnAssetInput,
    ));
  } catch (error) {
    return handleError(res, error);
  }
};

export const createJob = async (req: Request, res: Response) => {
  try {
    const idempotencyKey = typeof req.headers['idempotency-key'] === 'string'
      ? req.headers['idempotency-key']
      : undefined;
    const job = await virtualTryOnService.createJob(
      getUserId(req),
      req.body as CreateVirtualTryOnJobInput,
      idempotencyKey,
    );
    return created(res, job);
  } catch (error) {
    return handleError(res, error);
  }
};

export const getJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.getJob(getUserId(req), req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const getLatestJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.getLatestJob(getUserId(req)));
  } catch (error) {
    return handleError(res, error);
  }
};

export const listJobs = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.listJobs(getUserId(req), getQuery(req)));
  } catch (error) {
    return handleError(res, error);
  }
};

export const getCapabilities = async (_req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.getCapabilities());
  } catch (error) {
    return handleError(res, error);
  }
};

export const retryJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.retryJob(getUserId(req), req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const retryVideo = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.retryVideo(getUserId(req), req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const cancelJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.cancelJob(getUserId(req), req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.deleteJob(getUserId(req), req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const listAdminJobs = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.listAdminJobs(getAdminQuery(req)));
  } catch (error) {
    return handleError(res, error);
  }
};

export const getAdminSummary = async (_req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.getAdminSummary());
  } catch (error) {
    return handleError(res, error);
  }
};

export const getAdminSettings = async (_req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.getAdminSettings());
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateAdminSettings = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await virtualTryOnService.updateAdminSettings(
        req.body,
        getUserId(req),
        getAdminActorRole(req),
      ),
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const rollbackAdminSettings = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await virtualTryOnService.rollbackAdminSettings(
        req.body,
        getUserId(req),
        getAdminActorRole(req),
      ),
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const testAdminPrompt = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.testAdminPrompt(req.body));
  } catch (error) {
    return handleError(res, error);
  }
};

export const getContextPresets = async (_req: Request, res: Response) => {
  try {
    return ok(res, virtualTryOnService.getContextPresetPreviews());
  } catch (error) {
    return handleError(res, error);
  }
};

export const retryAdminJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.retryAdminJob(req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const retryAdminVideo = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.retryAdminVideo(req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const cancelAdminJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.cancelAdminJob(req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const hideAdminJob = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.hideAdminJob(req.params.jobId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const listPromptRules = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.listPromptRules(getPromptRuleListQuery(req)));
  } catch (error) {
    return handleError(res, error);
  }
};

export const createPromptRule = async (req: Request, res: Response) => {
  try {
    const rule = await virtualTryOnService.createPromptRule(
      getUserId(req),
      req.body as CreatePromptRuleInput,
    );
    return created(res, rule);
  } catch (error) {
    return handleError(res, error);
  }
};

export const updatePromptRule = async (req: Request, res: Response) => {
  try {
    return ok(
      res,
      await virtualTryOnService.updatePromptRule(
        getUserId(req),
        req.params.ruleId as string,
        req.body as UpdatePromptRuleInput,
      ),
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const deletePromptRule = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.deletePromptRule(getUserId(req), req.params.ruleId as string));
  } catch (error) {
    return handleError(res, error);
  }
};

export const listAccountLocks = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.listAccountLocks(getAccountLockListQuery(req)));
  } catch (error) {
    return handleError(res, error);
  }
};

export const lockAccount = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.lockAccount(getUserId(req), req.body as LockAccountInput));
  } catch (error) {
    return handleError(res, error);
  }
};

export const unlockAccount = async (req: Request, res: Response) => {
  try {
    return ok(res, await virtualTryOnService.unlockAccount(getUserId(req), req.params.userId as string));
  } catch (error) {
    return handleError(res, error);
  }
};
