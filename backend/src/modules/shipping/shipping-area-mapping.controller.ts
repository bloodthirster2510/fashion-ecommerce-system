import type { Request, Response } from 'express';
import type {
  ShippingAreaMappingConfidence,
  ShippingAreaMappingStatus,
} from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';
import { error as errorResponse, ok } from '../../utils/response';
import {
  shippingAreaMappingService,
  type ShippingAreaMappingUpsertInput,
} from './shipping-area-mapping.service';

const MAPPING_STATUSES: ShippingAreaMappingStatus[] = ['pending', 'verified', 'disabled'];
const MAPPING_CONFIDENCES: ShippingAreaMappingConfidence[] = ['exact', 'manual', 'legacy'];

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallback;
};

const getErrorResponse = (error: unknown) => {
  const statusCode =
    typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && typeof error.statusCode === 'number'
      ? error.statusCode
      : 500;

  return {
    statusCode,
    message: error instanceof Error ? error.message : 'Không thể xử lý mapping GHN',
  };
};

export const listShippingAreaMappings = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    if (status && !MAPPING_STATUSES.includes(status as ShippingAreaMappingStatus)) {
      return errorResponse(res, 'Trạng thái mapping không hợp lệ', 400);
    }

    const result = await shippingAreaMappingService.listMappings({
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
      status: status as ShippingAreaMappingStatus | undefined,
      page: parsePositiveInteger(req.query.page, 1),
      limit: parsePositiveInteger(req.query.limit, 20),
    });
    return ok(res, result);
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const getShippingAreaMappingCoverage = async (_req: Request, res: Response) => {
  try {
    return ok(res, await shippingAreaMappingService.getCoverage());
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const importShippingAreaMappings = async (req: Request, res: Response) => {
  try {
    const mappings = Array.isArray(req.body?.mappings)
      ? req.body.mappings as ShippingAreaMappingUpsertInput[]
      : [];
    if (!mappings.length || mappings.length > 1000) {
      return errorResponse(res, 'mappings phải có từ 1 đến 1000 dòng', 400);
    }

    const result = await shippingAreaMappingService.upsertMappings({
      mappings,
      actorId: req.user?.userId,
      backfill: req.body?.backfill !== false,
    });

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'shipping_mapping.import',
      targetType: 'ShippingAreaMapping',
      targetId: 'bulk',
      reason: typeof req.body?.reason === 'string' ? req.body.reason : 'Imported GHN mappings',
      metadata: {
        importedCount: result.importedCount,
        backfilledOrders: result.backfilledOrders,
        backfilledUserDocuments: result.backfilledUserDocuments,
      },
    });

    return ok(res, result, 'Đã import mapping GHN');
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};

export const reviewShippingAreaMapping = async (req: Request, res: Response) => {
  try {
    const status = req.body?.status as ShippingAreaMappingStatus | undefined;
    const confidence = req.body?.confidence as ShippingAreaMappingConfidence | undefined;
    if (!status || !MAPPING_STATUSES.includes(status)) {
      return errorResponse(res, 'Trạng thái mapping không hợp lệ', 400);
    }
    if (confidence && !MAPPING_CONFIDENCES.includes(confidence)) {
      return errorResponse(res, 'Độ tin cậy mapping không hợp lệ', 400);
    }

    const result = await shippingAreaMappingService.reviewMapping({
      id: req.params.id as string,
      status,
      confidence,
      note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      actorId: req.user?.userId,
      backfill: req.body?.backfill !== false,
    });

    await auditLogService.recordAuditLogBestEffort({
      actorId: req.user?.userId ?? null,
      actorRole: req.user?.role === 'admin' ? 'admin' : 'staff',
      action: 'shipping_mapping.review',
      targetType: 'ShippingAreaMapping',
      targetId: req.params.id as string,
      reason: typeof req.body?.note === 'string' ? req.body.note : `Mapping ${status}`,
      after: {
        status: result.mapping.status,
        confidence: result.mapping.confidence,
        verifiedAt: result.mapping.verifiedAt,
      },
      metadata: {
        backfilledOrders: result.backfilledOrders,
        backfilledUserDocuments: result.backfilledUserDocuments,
      },
    });

    return ok(res, result, 'Đã cập nhật mapping GHN');
  } catch (error) {
    const { statusCode, message } = getErrorResponse(error);
    return errorResponse(res, message, statusCode);
  }
};
