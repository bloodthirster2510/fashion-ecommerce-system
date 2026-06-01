import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import { InventoryServiceError, inventoryService } from './inventory.service';
import type {
  AdjustInventoryInput,
  CreateInventoryImportInput,
  InventoryImportListQueryInput,
  InventoryListQueryInput,
  ReserveInventoryInput,
} from './inventory.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof InventoryServiceError || hasStatusCode(e)) {
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

const parsePositiveNumber = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const numericValue = Number(stringValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  const numericValue = parsePositiveNumber(value, fieldName);

  if (numericValue === undefined) {
    return undefined;
  }

  if (!Number.isInteger(numericValue)) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }

  return numericValue;
};

const parseDate = (value: unknown, fieldName: string) => {
  const stringValue = parseString(value);

  if (!stringValue) {
    return undefined;
  }

  const date = new Date(stringValue);

  if (Number.isNaN(date.getTime())) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }

  return date;
};

const parseStringList = (value: unknown) => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseInventoryQuery = (req: Request): InventoryListQueryInput => ({
  productId: parseString(req.query.productId),
  variantId: parseString(req.query.variantId),
  colorVariantId: parseString(req.query.colorVariantId),
  size: parseString(req.query.size),
  page: parsePositiveInteger(req.query.page, 'page'),
  limit: parsePositiveInteger(req.query.limit, 'limit'),
});

const parseImportQuery = (req: Request): InventoryImportListQueryInput => ({
  productId: parseString(req.query.productId),
  variantId: parseString(req.query.variantId),
  colorVariantId: parseString(req.query.colorVariantId),
  from: parseDate(req.query.from, 'from'),
  to: parseDate(req.query.to, 'to'),
  page: parsePositiveInteger(req.query.page, 'page'),
  limit: parsePositiveInteger(req.query.limit, 'limit'),
});

const getInventory = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getInventory(parseInventoryQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getLowStockInventory = async (req: Request, res: Response) => {
  try {
    const threshold = parsePositiveInteger(req.query.threshold, 'threshold') ?? 5;
    const result = await inventoryService.getLowStockInventory(threshold, parseInventoryQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getImports = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getImports(parseImportQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getImportById = async (req: Request, res: Response) => {
  try {
    const importRecord = await inventoryService.getImportById(req.params.id as string);
    return ok(res, importRecord);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const createImport = async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateInventoryImportInput;

    if (!body.productId || !body.variantId || !body.colorVariantId || !body.detail?.length) {
      return errorResponse(res, 'productId, variantId, colorVariantId, and detail are required', 400);
    }

    const importRecord = await inventoryService.createImport(body);
    return created(res, importRecord);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const adjustInventory = async (req: Request, res: Response) => {
  try {
    const input: AdjustInventoryInput = {
      quantity:
        req.body.quantity !== undefined
          ? Number(req.body.quantity)
          : undefined,
      deltaQuantity:
        req.body.deltaQuantity !== undefined
          ? Number(req.body.deltaQuantity)
          : undefined,
    };

    const inventory = await inventoryService.adjustInventory(req.params.id as string, input);
    return ok(res, inventory);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const reserveInventory = async (req: Request, res: Response) => {
  try {
    const body = req.body as ReserveInventoryInput & { expiresAt?: string | Date };
    const reservations = await inventoryService.reserveInventory({
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return created(res, reservations);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const releaseReservations = async (req: Request, res: Response) => {
  try {
    const reservations = await inventoryService.releaseReservations({
      reservationIds: parseStringList(req.body.reservationIds),
      orderId: parseString(req.body.orderId),
    });

    return ok(res, reservations);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const commitReservations = async (req: Request, res: Response) => {
  try {
    const reservations = await inventoryService.commitReservations({
      reservationIds: parseStringList(req.body.reservationIds),
      orderId: parseString(req.body.orderId),
    });

    return ok(res, reservations);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const expireReservations = async (_req: Request, res: Response) => {
  try {
    const reservations = await inventoryService.expireReservations();
    return ok(res, reservations);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  adjustInventory,
  commitReservations,
  createImport,
  expireReservations,
  getImportById,
  getImports,
  getInventory,
  getLowStockInventory,
  releaseReservations,
  reserveInventory,
};
