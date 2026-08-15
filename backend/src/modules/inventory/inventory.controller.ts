import type { Request, Response } from 'express';
import { created, error as errorResponse, ok } from '../../utils/response';
import { productService } from '../catalog/products/product.service';
import { InventoryServiceError, inventoryService } from './inventory.service';
import type {
  AdjustInventoryInput,
  CreateStocktakeInput,
  CreateInventoryImportInput,
  CreateInventoryReceiptInput,
  InventoryImportListQueryInput,
  InventoryListQueryInput,
  InventoryMovementListQueryInput,
  InventoryReceiptListQueryInput,
  InventoryReceiptStatus,
  UpdateInventoryReceiptInput,
  UpsertInventorySupplierInput,
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
    if (e.statusCode >= 500) {
      console.error('Inventory controller error:', e);
      return {
        statusCode: e.statusCode,
        message: 'Internal Server Error',
      };
    }

    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  console.error('Inventory controller error:', e);
  return {
    statusCode: 500,
    message: 'Internal Server Error',
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

const parseReceiptStatus = (value: unknown): InventoryReceiptStatus | undefined => {
  const status = parseString(value);
  if (!status) return undefined;

  if (!['draft', 'confirmed', 'cancelled'].includes(status)) {
    throw new InventoryServiceError('Invalid status', 400);
  }

  return status as InventoryReceiptStatus;
};

const parseReceiptQuery = (req: Request): InventoryReceiptListQueryInput => ({
  status: parseReceiptStatus(req.query.status),
  from: parseDate(req.query.from, 'from'),
  to: parseDate(req.query.to, 'to'),
  page: parsePositiveInteger(req.query.page, 'page'),
  limit: parsePositiveInteger(req.query.limit, 'limit'),
});

const parseMovementQuery = (req: Request): InventoryMovementListQueryInput => ({
  ...parseInventoryQuery(req),
  type: parseString(req.query.type),
  from: parseDate(req.query.from, 'from'),
  to: parseDate(req.query.to, 'to'),
});

const parseBodyDate = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }

  return date;
};

const getAuthenticatedUserId = (req: Request) => req.user?.userId;

const normalizeReceiptBody = <T extends CreateInventoryReceiptInput | UpdateInventoryReceiptInput>(body: T): T => ({
  ...body,
  importDate: parseBodyDate(body.importDate, 'importDate'),
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

const getInventoryProducts = async (_req: Request, res: Response) => {
  try {
    const products = await productService.getManagementProducts();
    return ok(res, products);
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

const getInventoryThreshold = async (_req: Request, res: Response) => {
  try {
    const result = await inventoryService.getInventoryThreshold();
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getMovements = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getMovements(parseMovementQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getReceipts = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getReceipts(parseReceiptQuery(req));
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getReceiptById = async (req: Request, res: Response) => {
  try {
    const receipt = await inventoryService.getReceiptById(req.params.id as string);
    return ok(res, receipt);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const createReceipt = async (req: Request, res: Response) => {
  try {
    const body = normalizeReceiptBody(req.body as CreateInventoryReceiptInput);
    const receipt = await inventoryService.createReceipt(body, getAuthenticatedUserId(req));
    return created(res, receipt);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateReceipt = async (req: Request, res: Response) => {
  try {
    const body = normalizeReceiptBody(req.body as UpdateInventoryReceiptInput);
    const receipt = await inventoryService.updateReceipt(req.params.id as string, body);
    return ok(res, receipt);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const confirmReceipt = async (req: Request, res: Response) => {
  try {
    const receipt = await inventoryService.confirmReceipt(req.params.id as string);
    return ok(res, receipt);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const cancelReceipt = async (req: Request, res: Response) => {
  try {
    const receipt = await inventoryService.cancelReceipt(req.params.id as string);
    return ok(res, receipt);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getImportSuppliers = async (_req: Request, res: Response) => {
  try {
    const result = await inventoryService.getImportSuppliers();
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

    const importRecord = await inventoryService.createImport(body, getAuthenticatedUserId(req));
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
      reason: parseString(req.body.reason),
      note: parseString(req.body.note),
    };

    const inventory = await inventoryService.adjustInventory(req.params.id as string, input, getAuthenticatedUserId(req));
    return ok(res, inventory);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteImport = async (req: Request, res: Response) => {
  try {
    const importRecord = await inventoryService.deleteImport(req.params.id as string, getAuthenticatedUserId(req));
    return ok(res, importRecord);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateInventoryThreshold = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.updateInventoryThreshold({
      lowStockThreshold: Number(req.body.lowStockThreshold),
    });
    return ok(res, result);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const getSuppliers = async (_req: Request, res: Response) => {
  try {
    const suppliers = await inventoryService.listSuppliers();
    return ok(res, suppliers);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const createSupplier = async (req: Request, res: Response) => {
  try {
    const supplier = await inventoryService.createSupplier(req.body as UpsertInventorySupplierInput);
    return created(res, supplier);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateSupplier = async (req: Request, res: Response) => {
  try {
    const supplier = await inventoryService.updateSupplier(
      req.params.id as string,
      req.body as Partial<UpsertInventorySupplierInput>,
    );
    return ok(res, supplier);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const supplier = await inventoryService.deleteSupplier(req.params.id as string);
    return ok(res, supplier);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const createStocktake = async (req: Request, res: Response) => {
  try {
    const stocktake = await inventoryService.createStocktake(
      req.body as CreateStocktakeInput,
      getAuthenticatedUserId(req),
    );
    return created(res, stocktake);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteInventory = async (req: Request, res: Response) => {
  try {
    const inventory = await inventoryService.deleteInventory(req.params.id as string);
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
  cancelReceipt,
  commitReservations,
  createImport,
  createReceipt,
  createStocktake,
  createSupplier,
  deleteInventory,
  deleteImport,
  deleteSupplier,
  expireReservations,
  getImportById,
  getImportSuppliers,
  getImports,
  getInventory,
  getInventoryProducts,
  getInventoryThreshold,
  getLowStockInventory,
  getMovements,
  getReceiptById,
  getReceipts,
  getSuppliers,
  confirmReceipt,
  releaseReservations,
  reserveInventory,
  updateInventoryThreshold,
  updateReceipt,
  updateSupplier,
};
