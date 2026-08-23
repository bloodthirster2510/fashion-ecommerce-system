import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  Inventory,
  InventoryImport,
  InventoryMovement,
  InventoryReceipt,
  InventoryReservation,
  InventoryStocktake,
  InventorySupplier,
  Product,
  type IInventory,
  type IInventoryImport,
  type IInventoryImportDetail,
  type IInventoryReceipt,
  type IInventoryReceiptLineDetail,
  type IInventoryReservation,
  type IInventoryStocktake,
  type IProductVariant,
  type InventoryMovementType,
  type InventoryReservationStatus,
} from '../../database/models';
import type {
  AdjustInventoryInput,
  CreateStocktakeInput,
  CreateInventoryImportInput,
  CreateInventoryReceiptInput,
  InventoryImportDetailInput,
  InventoryImportListQueryInput,
  InventoryListQueryInput,
  InventoryMovementListQueryInput,
  InventoryReceiptLineInput,
  InventoryReceiptListQueryInput,
  InventoryReceiptStatus,
  InventoryReservationItemInput,
  ReservationSelectorInput,
  ReserveInventoryInput,
  UpdateInventoryThresholdInput,
  UpdateInventoryReceiptInput,
  UpsertInventorySupplierInput,
} from './inventory.types';
import { invalidateProductCatalogCache } from '../catalog/products/product.cache';

export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'InventoryServiceError';
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_RESERVATION_TTL_MINUTES = 15;
const MAX_IMPORT_QUANTITY = 1_000_000;
const MAX_IMPORT_PRICE = 1_000_000_000;
const MAX_IMPORT_TOTAL = 1_000_000_000_000_000;
const MAX_IMPORT_CODE_LENGTH = 40;

type SessionOptions = {
  session?: ClientSession;
};

const isTransactionUnsupportedError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('Transactions are not supported') ||
    message.includes('This MongoDB deployment does not support retryable writes')
  );
};

const runWithOptionalTransaction = async (
  operation: (options: SessionOptions) => Promise<void>,
) => {
  const session = await mongoose.startSession();

  try {
    try {
      await session.withTransaction(async () => operation({ session }));
      return;
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
    }
  } finally {
    await session.endSession();
  }

  await operation({});
};

type CreateImportOptions = SessionOptions & {
  importCode?: string;
  receiptId?: Types.ObjectId;
  receiptCode?: string;
  createdBy?: Types.ObjectId | null;
};

type InventorySnapshot = Pick<
  IInventory,
  | '_id'
  | 'productId'
  | 'variantId'
  | 'colorVariantId'
  | 'size'
  | 'sku'
  | 'quantity'
  | 'reservedQuantity'
  | 'availableQuantity'
>;

const assertValidObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }
};

const toObjectId = (id: string, fieldName: string) => {
  assertValidObjectId(id, fieldName);
  return new Types.ObjectId(id);
};

const toIdString = (value: Types.ObjectId | string | { toString(): string } | null | undefined) => {
  return value?.toString() ?? '';
};

const normalizeSize = (value: string) => value.trim();
const normalizeSupplierName = (value: string | undefined) => value?.trim().slice(0, 120) ?? '';
const normalizeShortText = (value: string | undefined, maxLength = 160) =>
  value?.trim().slice(0, maxLength) ?? '';
const normalizeLongText = (value: string | undefined, maxLength = 1000) =>
  value?.trim().slice(0, maxLength) ?? '';

const assertPositiveInteger = (
  value: number,
  fieldName: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new InventoryServiceError(`${fieldName} must be an integer greater than or equal to ${min}`, 400);
  }
};

const assertSafeMoney = (value: number, fieldName: string) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_IMPORT_PRICE) {
    throw new InventoryServiceError(`${fieldName} must be a safe integer between 0 and ${MAX_IMPORT_PRICE}`, 400);
  }
};

const isDuplicateKeyError = (error: unknown) => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
};

const clampPagination = (
  query: InventoryListQueryInput | InventoryImportListQueryInput | InventoryReceiptListQueryInput,
) => {
  const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit };
};

const buildSku = (productId: string, variantId: string, colorVariantId: string, size: string) => {
  const skuSize = size.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return [
    'INV',
    productId.slice(-6),
    variantId.slice(-6),
    colorVariantId.slice(-6),
    skuSize || 'SIZE',
  ].join('-').toUpperCase();
};

const assertUniqueImportSizes = (details: InventoryImportDetailInput[]) => {
  const normalizedSizes = details.map((detail) => normalizeSize(detail.size).toLowerCase());

  if (new Set(normalizedSizes).size !== normalizedSizes.length) {
    throw new InventoryServiceError('Duplicate size in import detail', 400);
  }
};

const normalizeImportDetails = (details: InventoryImportDetailInput[]) => {
  if (!details?.length) {
    throw new InventoryServiceError('Import detail is required', 400);
  }

  assertUniqueImportSizes(details);

  return details.map((detail) => {
    const size = normalizeSize(detail.size);

    if (!size) {
      throw new InventoryServiceError('Import detail size is required', 400);
    }

    assertPositiveInteger(detail.quantity, 'Import detail quantity', 1, MAX_IMPORT_QUANTITY);

    const remainingQuantity = detail.remainingQuantity ?? detail.quantity;
    assertPositiveInteger(remainingQuantity, 'Import detail remainingQuantity', 0, detail.quantity);

    if (remainingQuantity > detail.quantity) {
      throw new InventoryServiceError('Import detail remainingQuantity cannot be greater than quantity', 400);
    }

    if (detail.importPrice !== undefined) {
      assertSafeMoney(detail.importPrice, 'Import detail importPrice');
    }

    return {
      size,
      quantity: detail.quantity,
      remainingQuantity,
      importPrice: detail.importPrice,
    };
  });
};

const findProductSelection = async (
  productId: string,
  variantId: string,
  colorVariantId: string,
  size: string,
  options: { requireSellable?: boolean; session?: ClientSession } = {},
) => {
  const productObjectId = toObjectId(productId, 'productId');
  const variantObjectId = toObjectId(variantId, 'variantId');
  const colorVariantObjectId = toObjectId(colorVariantId, 'colorVariantId');
  const query = Product.findById(productObjectId);
  const product = await (options.session ? query.session(options.session) : query);

  if (!product) {
    throw new InventoryServiceError('Product not found', 404);
  }

  if (options.requireSellable && !product.isActive) {
    throw new InventoryServiceError('Product is not active', 400);
  }

  const normalizedVariantId = variantObjectId.toString();
  const variant = product.variant.find(
    (item: IProductVariant) => toIdString(item._id) === normalizedVariantId,
  );
  if (!variant) {
    throw new InventoryServiceError('Variant not found in product', 404);
  }

  if (options.requireSellable && !variant.isActive) {
    throw new InventoryServiceError('Variant is not active', 400);
  }

  const normalizedColorVariantId = colorVariantObjectId.toString();
  const color = variant.colors.find(
    (item: IProductVariant['colors'][number]) => toIdString(item._id) === normalizedColorVariantId,
  );
  if (!color) {
    throw new InventoryServiceError('Color variant not found in product variant', 404);
  }

  const normalizedSize = normalizeSize(size);
  const hasSize = variant.sizeMeasurements.some(
    (sizeMeasurement: IProductVariant['sizeMeasurements'][number]) =>
      sizeMeasurement.size.trim().toLowerCase() === normalizedSize.toLowerCase(),
  );

  if (!hasSize) {
    throw new InventoryServiceError('Size not found in product variant', 404);
  }

  return {
    product,
    variant,
    color,
    size: normalizedSize,
    sku: buildSku(productId, variantId, colorVariantId, normalizedSize),
  };
};

const buildInventoryFilter = (query: InventoryListQueryInput): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (query.productId) {
    filter.productId = toObjectId(query.productId, 'productId');
  }

  if (query.variantId) {
    filter.variantId = toObjectId(query.variantId, 'variantId');
  }

  if (query.colorVariantId) {
    filter.colorVariantId = toObjectId(query.colorVariantId, 'colorVariantId');
  }

  if (query.size) {
    filter.size = new RegExp(`^${query.size.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  }

  return filter;
};

const buildImportFilter = (query: InventoryImportListQueryInput) => {
  const filter: Record<string, unknown> = {};

  if (query.productId) {
    filter.productId = toObjectId(query.productId, 'productId');
  }

  if (query.variantId) {
    filter.variantId = toObjectId(query.variantId, 'variantId');
  }

  if (query.colorVariantId) {
    filter.colorVariantId = toObjectId(query.colorVariantId, 'colorVariantId');
  }

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  return filter;
};

const buildReceiptFilter = (query: InventoryReceiptListQueryInput) => {
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.from || query.to) {
    filter.importDate = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  return filter;
};

const buildMovementFilter = (query: InventoryMovementListQueryInput) => {
  const filter: Record<string, unknown> = buildInventoryFilter(query);

  if (query.type) {
    filter.type = query.type;
  }

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  return filter;
};

const normalizeReceiptCode = (value: string | undefined) =>
  value?.trim().toUpperCase().slice(0, MAX_IMPORT_CODE_LENGTH);

const normalizeReceiptStatus = (value: InventoryReceiptStatus | undefined) => {
  if (!value) return 'draft';
  if (!['draft', 'confirmed', 'cancelled'].includes(value)) {
    throw new InventoryServiceError('Invalid receipt status', 400);
  }

  return value;
};

const normalizeReceiptDate = (value: Date | undefined) => {
  if (!value) return new Date();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InventoryServiceError('Invalid importDate', 400);
  }

  return date;
};

const normalizeReceiptNote = (value: string | undefined) => value?.trim().slice(0, 1000) ?? '';

const getReceiptTotals = (lines: Array<{ detail: Array<{ quantity: number; importPrice?: number }> }>) => {
  let totalQuantity = 0;
  let totalAmount = 0;

  for (const line of lines) {
    for (const detail of line.detail) {
      totalQuantity += detail.quantity;
      const lineAmount = detail.quantity * (detail.importPrice ?? 0);
      totalAmount += lineAmount;

      if (!Number.isSafeInteger(totalQuantity) || totalQuantity > MAX_IMPORT_QUANTITY * 1000) {
        throw new InventoryServiceError('Receipt total quantity is too large', 400);
      }

      if (!Number.isSafeInteger(lineAmount) || !Number.isSafeInteger(totalAmount) || totalAmount > MAX_IMPORT_TOTAL) {
        throw new InventoryServiceError('Receipt total amount is too large', 400);
      }
    }
  }

  return { totalQuantity, totalAmount };
};

const buildReceiptCode = async () => {
  const receiptCodes = await InventoryReceipt.find({ receiptCode: /^PN\d+$/ })
    .select('receiptCode')
    .lean();
  const maxNumber = receiptCodes.reduce((max, item) => {
    const match = item.receiptCode.match(/^PN(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `PN${String(maxNumber + 1).padStart(5, '0')}`;
};

const buildReceiptImportCode = (receiptCode: string, lineIndex: number) => {
  const suffix = String(lineIndex + 1).padStart(2, '0');
  const prefixLength = Math.max(0, MAX_IMPORT_CODE_LENGTH - suffix.length - 1);
  const prefix = receiptCode.slice(0, prefixLength);

  return `${prefix}-${suffix}`;
};

const normalizeReceiptLines = async (
  lines: InventoryReceiptLineInput[] | undefined,
  options: SessionOptions = {},
) => {
  if (!lines?.length) {
    return [];
  }

  const seenSelectors = new Set<string>();
  const normalizedLines = [];

  for (const line of lines) {
    const productId = toObjectId(line.productId, 'productId');
    const variantId = toObjectId(line.variantId, 'variantId');
    const colorVariantId = toObjectId(line.colorVariantId, 'colorVariantId');
    const normalizedDetails = normalizeImportDetails(line.detail).map((detail) => ({
      size: detail.size,
      quantity: detail.quantity,
      importPrice: detail.importPrice,
    }));

    for (const detail of normalizedDetails) {
      await findProductSelection(line.productId, line.variantId, line.colorVariantId, detail.size, options);

      const selector = [
        productId.toString(),
        variantId.toString(),
        colorVariantId.toString(),
        detail.size.toLowerCase(),
      ].join(':');

      if (seenSelectors.has(selector)) {
        throw new InventoryServiceError('Duplicate product variant size in receipt', 400);
      }

      seenSelectors.add(selector);
    }

    normalizedLines.push({
      productId,
      variantId,
      colorVariantId,
      detail: normalizedDetails,
    });
  }

  return normalizedLines;
};

const getInventoryByIdOrThrow = async (id: string) => {
  assertValidObjectId(id, 'inventory id');

  const inventory = await Inventory.findById(id);
  if (!inventory) {
    throw new InventoryServiceError('Inventory item not found', 404);
  }

  return inventory;
};

const createMovement = async (
  inventory: InventorySnapshot,
  delta: {
    quantityDelta: number;
    reservedDelta?: number;
    availableDelta?: number;
  },
  options: SessionOptions & {
    type: InventoryMovementType;
    reason?: string;
    note?: string;
    sourceId?: Types.ObjectId | null;
    sourceCode?: string;
    sourceType?: string;
    createdBy?: Types.ObjectId | null;
  },
) => {
  const reservedDelta = delta.reservedDelta ?? 0;
  const availableDelta = delta.availableDelta ?? 0;
  const payload = {
    inventoryId: inventory._id,
    productId: inventory.productId,
    variantId: inventory.variantId,
    colorVariantId: inventory.colorVariantId,
    size: inventory.size,
    sku: inventory.sku,
    type: options.type,
    quantityDelta: delta.quantityDelta,
    reservedDelta,
    availableDelta,
    quantityBefore: inventory.quantity - delta.quantityDelta,
    quantityAfter: inventory.quantity,
    reservedBefore: inventory.reservedQuantity - reservedDelta,
    reservedAfter: inventory.reservedQuantity,
    availableBefore: inventory.availableQuantity - availableDelta,
    availableAfter: inventory.availableQuantity,
    reason: normalizeShortText(options.reason),
    note: normalizeLongText(options.note),
    sourceId: options.sourceId ?? null,
    sourceCode: normalizeShortText(options.sourceCode, 80),
    sourceType: normalizeShortText(options.sourceType, 40),
    createdBy: options.createdBy ?? null,
  };

  if (options.session) {
    await InventoryMovement.create([payload], { session: options.session });
    return;
  }

  await InventoryMovement.create(payload);
};

const upsertSupplierByName = async (supplierName: string, options: SessionOptions = {}) => {
  const name = normalizeSupplierName(supplierName);
  if (!name) return;

  const update = {
    $setOnInsert: {
      name,
      isActive: true,
    },
  };

  if (options.session) {
    await InventorySupplier.updateOne({ name }, update, { upsert: true, session: options.session });
    return;
  }

  await InventorySupplier.updateOne({ name }, update, { upsert: true });
};

const createImportAndAdjustInventory = async (
  input: CreateInventoryImportInput,
  options: CreateImportOptions = {},
) => {
  const productId = toObjectId(input.productId, 'productId');
  const variantId = toObjectId(input.variantId, 'variantId');
  const colorVariantId = toObjectId(input.colorVariantId, 'colorVariantId');
  const detail = normalizeImportDetails(input.detail);
  const supplierName = normalizeSupplierName(input.supplierName);

  await Promise.all(
    detail.map((item) =>
      findProductSelection(input.productId, input.variantId, input.colorVariantId, item.size, {
        session: options.session,
      }),
    ),
  );

  const importPayload = {
    importCode: options.importCode ?? buildImportCode(),
    receiptId: options.receiptId ?? null,
    receiptCode: normalizeReceiptCode(options.receiptCode) ?? '',
    supplierName,
    productId,
    variantId,
    colorVariantId,
    detail,
    totalAmount: getImportTotalAmount(detail),
  };
  const [createdImportRecord] = await InventoryImport.create([importPayload], {
    ...(options.session ? { session: options.session } : {}),
  });
  await upsertSupplierByName(supplierName, options);

  for (const item of detail) {
    const sku = buildSku(input.productId, input.variantId, input.colorVariantId, item.size);

    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        variantId,
        colorVariantId,
        size: item.size,
      },
      {
        $setOnInsert: {
          productId,
          variantId,
          colorVariantId,
          size: item.size,
          sku,
          reservedQuantity: 0,
        },
        $inc: {
          quantity: item.quantity,
          availableQuantity: item.quantity,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        ...(options.session ? { session: options.session } : {}),
      },
    );

    if (updatedInventory) {
      await createMovement(
        updatedInventory,
        {
          quantityDelta: item.quantity,
          availableDelta: item.quantity,
        },
        {
          type: 'import',
          reason: options.receiptId ? 'Xác nhận phiếu nhập' : 'Nhập kho',
          sourceId: createdImportRecord._id,
          sourceCode: createdImportRecord.importCode,
          sourceType: options.receiptId ? 'receipt' : 'import',
          createdBy: options.createdBy ?? null,
          session: options.session,
        },
      );
    }
  }

  return createdImportRecord;
};

const createImport = async (input: CreateInventoryImportInput, createdBy?: string) => {
  const session = await mongoose.startSession();
  let importRecord: IInventoryImport | null = null;
  const createdById = createdBy ? toObjectId(createdBy, 'createdBy') : null;

  try {
    await session.withTransaction(async () => {
      importRecord = await createImportAndAdjustInventory(input, { createdBy: createdById, session });
    });
  } finally {
    await session.endSession();
  }

  if (!importRecord) {
    throw new InventoryServiceError('Failed to create import', 500);
  }

  await invalidateProductCatalogCache();
  return importRecord;
};

const getInventory = async (query: InventoryListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = buildInventoryFilter(query);

  const [items, totalItems] = await Promise.all([
    Inventory.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Inventory.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getLowStockInventory = async (threshold: number, query: InventoryListQueryInput) => {
  assertPositiveInteger(threshold, 'threshold', 0);
  const filter = {
    ...buildInventoryFilter(query),
    availableQuantity: { $lte: threshold },
  };
  const { page, limit } = clampPagination(query);

  const [items, totalItems] = await Promise.all([
    Inventory.find(filter)
      .sort({ availableQuantity: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Inventory.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getImports = async (query: InventoryImportListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = buildImportFilter(query);

  const [items, totalItems] = await Promise.all([
    InventoryImport.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    InventoryImport.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getInventoryThreshold = async () => {
  const item = await Inventory.findOne()
    .sort({ updatedAt: -1 })
    .select('lowStockThreshold')
    .lean();

  return { lowStockThreshold: item?.lowStockThreshold ?? 5 };
};

const getMovements = async (query: InventoryMovementListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = buildMovementFilter(query);

  const [items, totalItems] = await Promise.all([
    InventoryMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    InventoryMovement.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const updateInventoryThreshold = async (input: UpdateInventoryThresholdInput) => {
  assertPositiveInteger(input.lowStockThreshold, 'lowStockThreshold', 0, 100_000);

  await Inventory.updateMany({}, { $set: { lowStockThreshold: input.lowStockThreshold } });

  return { lowStockThreshold: input.lowStockThreshold };
};

const getReceipts = async (query: InventoryReceiptListQueryInput) => {
  const { page, limit } = clampPagination(query);
  const filter = buildReceiptFilter(query);

  const [items, totalItems] = await Promise.all([
    InventoryReceipt.find(filter)
      .sort({ importDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    InventoryReceipt.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

const getReceiptById = async (id: string) => {
  assertValidObjectId(id, 'receipt id');

  const receipt = await InventoryReceipt.findById(id).lean();
  if (!receipt) {
    throw new InventoryServiceError('Receipt not found', 404);
  }

  return receipt;
};

const createReceipt = async (input: CreateInventoryReceiptInput, createdBy?: string) => {
  const status = normalizeReceiptStatus(input.status);
  if (status === 'cancelled') {
    throw new InventoryServiceError('Cannot create a cancelled receipt', 400);
  }

  const lines = await normalizeReceiptLines(input.lines);
  const totals = getReceiptTotals(lines);
  const requestedReceiptCode = normalizeReceiptCode(input.receiptCode);
  const createdById = createdBy ? toObjectId(createdBy, 'createdBy') : null;
  const maxAttempts = requestedReceiptCode ? 1 : 3;
  let receipt: IInventoryReceipt | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const receiptCode = requestedReceiptCode ?? (await buildReceiptCode());

    try {
      receipt = await InventoryReceipt.create({
        receiptCode,
        supplierName: normalizeSupplierName(input.supplierName),
        importDate: normalizeReceiptDate(input.importDate),
        createdBy: createdById,
        status: 'draft',
        note: normalizeReceiptNote(input.note),
        lines,
        ...totals,
      });
      break;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        if (requestedReceiptCode) {
          throw new InventoryServiceError('Receipt code already exists', 409);
        }

        continue;
      }

      throw error;
    }
  }

  if (!receipt) {
    throw new InventoryServiceError('Failed to create receipt code, please try again', 409);
  }

  if (status === 'confirmed') {
    return confirmReceipt(receipt._id.toString());
  }

  return receipt;
};

const updateReceipt = async (id: string, input: UpdateInventoryReceiptInput) => {
  assertValidObjectId(id, 'receipt id');

  const receipt = await InventoryReceipt.findById(id);
  if (!receipt) {
    throw new InventoryServiceError('Receipt not found', 404);
  }

  if (receipt.status !== 'draft') {
    throw new InventoryServiceError('Only draft receipts can be edited', 409);
  }

  if (input.receiptCode !== undefined) {
    const receiptCode = normalizeReceiptCode(input.receiptCode);
    if (!receiptCode) {
      throw new InventoryServiceError('Receipt code is required', 400);
    }
    receipt.receiptCode = receiptCode;
  }

  if (input.supplierName !== undefined) {
    receipt.supplierName = normalizeSupplierName(input.supplierName);
  }

  if (input.importDate !== undefined) {
    receipt.importDate = normalizeReceiptDate(input.importDate);
  }

  if (input.note !== undefined) {
    receipt.note = normalizeReceiptNote(input.note);
  }

  if (input.lines !== undefined) {
    const lines = await normalizeReceiptLines(input.lines);
    receipt.lines = lines as IInventoryReceipt['lines'];
    const totals = getReceiptTotals(lines);
    receipt.totalQuantity = totals.totalQuantity;
    receipt.totalAmount = totals.totalAmount;
  }

  try {
    return await receipt.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new InventoryServiceError('Receipt code already exists', 409);
    }

    throw error;
  }
};

const confirmReceipt = async (id: string) => {
  assertValidObjectId(id, 'receipt id');

  const session = await mongoose.startSession();
  let confirmedReceipt: IInventoryReceipt | null = null;

  try {
    await session.withTransaction(async () => {
      const receipt = await InventoryReceipt.findOneAndUpdate(
        { _id: new Types.ObjectId(id), status: 'draft' },
        {
          $set: {
            status: 'confirmed',
            confirmedAt: new Date(),
            cancelledAt: null,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session,
        },
      );
      if (!receipt) {
        const existingReceipt = await InventoryReceipt.findById(id).session(session);
        if (!existingReceipt) {
          throw new InventoryServiceError('Receipt not found', 404);
        }

        if (existingReceipt.status === 'confirmed') {
          confirmedReceipt = existingReceipt;
          return;
        }

        throw new InventoryServiceError('Only draft receipts can be confirmed', 409);
      }

      if (!receipt.lines.length) {
        throw new InventoryServiceError('Receipt must include at least one product before confirmation', 400);
      }

      const existingImport = await InventoryImport.exists({ receiptId: receipt._id }).session(session);
      if (existingImport) {
        throw new InventoryServiceError('Receipt has already generated import lots', 409);
      }

      for (const [lineIndex, line] of receipt.lines.entries()) {
        await createImportAndAdjustInventory(
          {
            productId: line.productId.toString(),
            variantId: line.variantId.toString(),
            colorVariantId: line.colorVariantId.toString(),
            supplierName: receipt.supplierName,
            detail: line.detail.map((detail: IInventoryReceiptLineDetail) => ({
              size: detail.size,
              quantity: detail.quantity,
              remainingQuantity: detail.quantity,
              importPrice: detail.importPrice,
            })),
          },
          {
            importCode: buildReceiptImportCode(receipt.receiptCode, lineIndex),
            receiptId: receipt._id,
            receiptCode: receipt.receiptCode,
            createdBy: receipt.createdBy ?? null,
            session,
          },
        );
      }

      confirmedReceipt = receipt;
    });
  } finally {
    await session.endSession();
  }

  if (!confirmedReceipt) {
    throw new InventoryServiceError('Failed to confirm receipt', 500);
  }

  await invalidateProductCatalogCache();
  return confirmedReceipt;
};

const cancelReceipt = async (id: string) => {
  assertValidObjectId(id, 'receipt id');

  const receipt = await InventoryReceipt.findById(id);
  if (!receipt) {
    throw new InventoryServiceError('Receipt not found', 404);
  }

  if (receipt.status !== 'draft') {
    throw new InventoryServiceError('Only draft receipts can be cancelled', 409);
  }

  receipt.status = 'cancelled';
  receipt.cancelledAt = new Date();

  return receipt.save();
};

const getImportSuppliers = async () => {
  const suppliers = await InventoryImport.distinct('supplierName', {
    supplierName: { $nin: [null, ''] },
  });

  return suppliers.sort((left: string, right: string) => left.localeCompare(right));
};

const getImportById = async (id: string) => {
  assertValidObjectId(id, 'import id');

  const importRecord = await InventoryImport.findById(id).lean();
  if (!importRecord) {
    throw new InventoryServiceError('Import not found', 404);
  }

  return importRecord;
};

const decrementInventoryForImport = async (
  importRecord: IInventoryImport,
  options: { session: ClientSession; createdBy?: Types.ObjectId | null },
) => {
  const importDetails = importRecord.detail as InventoryImportDetailInput[];

  if (importDetails.some((item) => (item.remainingQuantity ?? item.quantity) < item.quantity)) {
    throw new InventoryServiceError('Cannot delete import because imported stock has been used or reserved', 409);
  }

  for (const item of importDetails) {
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        productId: importRecord.productId,
        variantId: importRecord.variantId,
        colorVariantId: importRecord.colorVariantId,
        size: item.size,
        quantity: { $gte: item.quantity },
        availableQuantity: { $gte: item.quantity },
      },
      {
        $inc: {
          quantity: -item.quantity,
          availableQuantity: -item.quantity,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
        session: options.session,
      },
    );

    if (!updatedInventory) {
      throw new InventoryServiceError('Cannot delete import because imported stock has been used or reserved', 409);
    }

    await createMovement(
      updatedInventory,
      {
        quantityDelta: -item.quantity,
        availableDelta: -item.quantity,
      },
      {
        type: 'import_delete',
        reason: 'Xóa lô nhập',
        sourceId: importRecord._id,
        sourceCode: importRecord.importCode,
        sourceType: 'import',
        createdBy: options.createdBy ?? null,
        session: options.session,
      },
    );
  }
};

const deleteImport = async (id: string, createdBy?: string) => {
  assertValidObjectId(id, 'import id');
  const session = await mongoose.startSession();
  let deletedImport: IInventoryImport | null = null;
  const createdById = createdBy ? toObjectId(createdBy, 'createdBy') : null;

  try {
    await session.withTransaction(async () => {
      const importRecord = await InventoryImport.findById(id, null, { session });
      if (!importRecord) {
        throw new InventoryServiceError('Import not found', 404);
      }

      if (importRecord.receiptId) {
        throw new InventoryServiceError('Cannot delete an import lot generated from a receipt', 409);
      }

      await decrementInventoryForImport(importRecord, { createdBy: createdById, session });
      await importRecord.deleteOne({ session });
      deletedImport = importRecord;
    });
  } finally {
    await session.endSession();
  }

  if (!deletedImport) {
    throw new InventoryServiceError('Failed to delete import', 500);
  }

  await invalidateProductCatalogCache();
  return deletedImport;
};

const adjustInventory = async (id: string, input: AdjustInventoryInput, createdBy?: string) => {
  assertValidObjectId(id, 'inventory id');
  const reason = normalizeShortText(input.reason);
  const note = normalizeLongText(input.note);
  const createdById = createdBy ? toObjectId(createdBy, 'createdBy') : null;

  if (input.quantity === undefined && input.deltaQuantity === undefined) {
    throw new InventoryServiceError('quantity or deltaQuantity is required', 400);
  }

  if (input.quantity !== undefined && input.deltaQuantity !== undefined) {
    throw new InventoryServiceError('Use either quantity or deltaQuantity, not both', 400);
  }

  if (!reason) {
    throw new InventoryServiceError('reason is required', 400);
  }

  await runWithOptionalTransaction(async ({ session }) => {
      const inventoryId = new Types.ObjectId(id);
      const updateFilter: Record<string, unknown> = { _id: inventoryId };
      let updatePipeline: Record<string, unknown>[];
      let deltaQuantity = 0;

      if (input.quantity !== undefined) {
        assertPositiveInteger(input.quantity, 'quantity', 0);
        updateFilter.reservedQuantity = { $lte: input.quantity };
        updatePipeline = [
          {
            $set: {
              quantity: input.quantity,
              availableQuantity: { $subtract: [input.quantity, '$reservedQuantity'] },
            },
          },
        ];
      } else {
        deltaQuantity = Number(input.deltaQuantity);
        if (!Number.isInteger(deltaQuantity)) {
          throw new InventoryServiceError('deltaQuantity must be an integer', 400);
        }
        updateFilter.$expr = {
          $gte: [{ $add: ['$quantity', deltaQuantity] }, '$reservedQuantity'],
        };
        updatePipeline = [
          {
            $set: {
              quantity: { $add: ['$quantity', deltaQuantity] },
              availableQuantity: { $add: ['$availableQuantity', deltaQuantity] },
            },
          },
        ];
      }

      const previousInventory = await Inventory.findOneAndUpdate(
        updateFilter,
        updatePipeline,
        {
          returnDocument: 'before',
          runValidators: true,
          updatePipeline: true,
          ...(session ? { session } : {}),
        },
      );

      if (!previousInventory) {
        const existingInventory = await Inventory.findById(id);
        if (!existingInventory) {
          throw new InventoryServiceError('Inventory item not found', 404);
        }

        throw new InventoryServiceError('quantity cannot be lower than reservedQuantity', 400);
      }

      if (input.quantity !== undefined) {
        deltaQuantity = input.quantity - previousInventory.quantity;
      }

      if (deltaQuantity === 0) return;

      const selector = {
        productId: previousInventory.productId,
        variantId: previousInventory.variantId,
        colorVariantId: previousInventory.colorVariantId,
        size: previousInventory.size,
      };
      const unadjustedQuantity = await adjustImportRemainingQuantity(
        selector,
        Math.abs(deltaQuantity),
        deltaQuantity < 0 ? 'consume' : 'restore',
        { ...(session ? { session } : {}) },
      );

      if (deltaQuantity < 0 && unadjustedQuantity > 0) {
        throw new InventoryServiceError('Cannot decrease inventory below remaining import lots', 409);
      }

      if (deltaQuantity > 0 && unadjustedQuantity > 0) {
        await createAdjustmentImport(selector, unadjustedQuantity, { ...(session ? { session } : {}) });
      }

      await createMovement(
        {
          _id: previousInventory._id,
          productId: previousInventory.productId,
          variantId: previousInventory.variantId,
          colorVariantId: previousInventory.colorVariantId,
          size: previousInventory.size,
          sku: previousInventory.sku,
          quantity: previousInventory.quantity + deltaQuantity,
          reservedQuantity: previousInventory.reservedQuantity,
          availableQuantity: previousInventory.availableQuantity + deltaQuantity,
        } as InventorySnapshot,
        {
          quantityDelta: deltaQuantity,
          availableDelta: deltaQuantity,
        },
        {
          type: 'adjustment',
          reason,
          note,
          sourceId: previousInventory._id,
          sourceCode: previousInventory.sku,
          sourceType: 'inventory_adjustment',
          createdBy: createdById,
          ...(session ? { session } : {}),
        },
      );
  });

  const inventory = await getInventoryByIdOrThrow(id);
  await invalidateProductCatalogCache();
  return inventory;
};

const createAdjustmentImport = async (
  selector: {
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
  },
  quantity: number,
  options: SessionOptions = {},
) => {
  const payload = {
    supplierName: 'Điều chỉnh tồn kho',
    productId: selector.productId,
    variantId: selector.variantId,
    colorVariantId: selector.colorVariantId,
    detail: [
      {
        size: selector.size,
        quantity,
        remainingQuantity: quantity,
      },
    ],
    totalAmount: 0,
  };

  if (options.session) {
    await InventoryImport.create([payload], { session: options.session });
    return;
  }

  await InventoryImport.create(payload);
};

const buildImportCode = () => {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/\D/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `IMP-${timestamp}-${suffix}`;
};

const getImportTotalAmount = (details: Array<{ quantity: number; importPrice?: number }>) => {
  let totalAmount = 0;

  for (const detail of details) {
    const lineAmount = detail.quantity * (detail.importPrice ?? 0);
    totalAmount += lineAmount;

    if (!Number.isSafeInteger(lineAmount) || !Number.isSafeInteger(totalAmount) || totalAmount > MAX_IMPORT_TOTAL) {
      throw new InventoryServiceError('Import total amount is too large', 400);
    }
  }

  return totalAmount;
};

const adjustImportRemainingQuantity = async (
  selector: {
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
  },
  quantity: number,
  mode: 'consume' | 'restore',
  options: SessionOptions = {},
): Promise<number> => {
  let remaining = quantity;
  const query = InventoryImport.find({
    productId: selector.productId,
    variantId: selector.variantId,
    colorVariantId: selector.colorVariantId,
    'detail.size': selector.size,
  });
  if (options.session && typeof query.session === 'function') {
    query.session(options.session);
  }
  const imports = await query.sort({ createdAt: mode === 'consume' ? 1 : -1 });

  for (const importRecord of imports) {
    if (remaining <= 0) break;

    const detail = importRecord.detail.find((item: IInventoryImportDetail) => item.size === selector.size);
    if (!detail) continue;

    const adjustable =
      mode === 'consume'
        ? detail.remainingQuantity
        : detail.quantity - detail.remainingQuantity;
    const delta = Math.min(adjustable, remaining);
    if (delta <= 0) continue;

    detail.remainingQuantity += mode === 'consume' ? -delta : delta;
    remaining -= delta;
    if (options.session) {
      await importRecord.save({ session: options.session });
    } else {
      await importRecord.save();
    }
  }

  return remaining;
};

const consumeImportRemainingQuantities = async (
  items: Array<{
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
    quantity: number;
  }>,
  options: SessionOptions = {},
) => {
  for (const item of items) {
    await adjustImportRemainingQuantity(item, item.quantity, 'consume', options);
  }
};

const restoreImportRemainingQuantities = async (
  items: Array<{
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
    quantity: number;
  }>,
) => {
  for (const item of items) {
    await adjustImportRemainingQuantity(item, item.quantity, 'restore');
  }

  await invalidateProductCatalogCache();
};

const deleteInventory = async (id: string) => {
  const inventory = await getInventoryByIdOrThrow(id);

  if (inventory.reservedQuantity > 0) {
    throw new InventoryServiceError('Cannot delete inventory with active reservations', 409);
  }

  await inventory.deleteOne();
  await invalidateProductCatalogCache();
  return inventory;
};

const normalizeReservationItem = async (item: InventoryReservationItemInput, options: SessionOptions = {}) => {
  assertPositiveInteger(item.quantity, 'Reservation quantity');

  const selection = await findProductSelection(
    item.productId,
    item.variantId,
    item.colorVariantId,
    item.size,
    { requireSellable: true, session: options.session },
  );

  return {
    productId: toObjectId(item.productId, 'productId'),
    variantId: toObjectId(item.variantId, 'variantId'),
    colorVariantId: toObjectId(item.colorVariantId, 'colorVariantId'),
    size: selection.size,
    sku: selection.sku,
    quantity: item.quantity,
  };
};

const getReservationExpiresAt = (input: ReserveInventoryInput) => {
  if (input.expiresAt) {
    return input.expiresAt;
  }

  const ttlMinutes = input.ttlMinutes ?? DEFAULT_RESERVATION_TTL_MINUTES;
  assertPositiveInteger(ttlMinutes, 'ttlMinutes');

  return new Date(Date.now() + ttlMinutes * 60 * 1000);
};

const rollbackReservedItems = async (
  reservedItems: Array<{
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
    quantity: number;
  }>,
  options: SessionOptions = {},
) => {
  for (const item of reservedItems) {
    const filter = {
      productId: item.productId,
      variantId: item.variantId,
      colorVariantId: item.colorVariantId,
      size: item.size,
    };
    const update = {
      $inc: {
        reservedQuantity: -item.quantity,
        availableQuantity: item.quantity,
      },
    };

    if (options.session) {
      await Inventory.updateOne(filter, update, { session: options.session });
    } else {
      await Inventory.updateOne(filter, update);
    }
  }
};

const reserveInventory = async (input: ReserveInventoryInput, options: SessionOptions = {}) => {
  const userId = toObjectId(input.userId, 'userId');
  const orderId = input.orderId ? toObjectId(input.orderId, 'orderId') : null;

  if (!input.items?.length) {
    throw new InventoryServiceError('Reservation items are required', 400);
  }

  const expiresAt = getReservationExpiresAt(input);
  if (expiresAt <= new Date()) {
    throw new InventoryServiceError('expiresAt must be in the future', 400);
  }

  const normalizedItems: Array<Awaited<ReturnType<typeof normalizeReservationItem>>> = [];
  for (const item of input.items) {
    normalizedItems.push(await normalizeReservationItem(item, options));
  }
  const reservedItems: typeof normalizedItems = [];
  const reservations: IInventoryReservation[] = [];

  try {
    for (const item of normalizedItems) {
      const inventory = await Inventory.findOneAndUpdate(
        {
          productId: item.productId,
          variantId: item.variantId,
          colorVariantId: item.colorVariantId,
          size: item.size,
          availableQuantity: { $gte: item.quantity },
        },
        {
          $inc: {
            reservedQuantity: item.quantity,
            availableQuantity: -item.quantity,
          },
        },
        {
          returnDocument: 'after',
          ...(options.session ? { session: options.session } : {}),
        },
      );

      if (!inventory) {
        throw new InventoryServiceError('Insufficient available inventory', 409);
      }

      await createMovement(
        inventory,
        {
          quantityDelta: 0,
          reservedDelta: item.quantity,
          availableDelta: -item.quantity,
        },
        {
          type: 'reservation',
          reason: 'Giữ hàng cho đơn',
          sourceId: orderId,
          sourceCode: orderId?.toString(),
          sourceType: 'order',
          session: options.session,
        },
      );

      reservedItems.push(item);

      const reservationPayload = {
        userId,
        orderId,
        productId: item.productId,
        variantId: item.variantId,
        colorVariantId: item.colorVariantId,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        status: 'active',
        expiresAt,
      };
      const reservation = options.session
        ? (await InventoryReservation.create([reservationPayload], { session: options.session }))[0]
        : await InventoryReservation.create(reservationPayload);

      reservations.push(reservation);
    }
  } catch (error) {
    await rollbackReservedItems(reservedItems, options);
    throw error;
  }

  await invalidateProductCatalogCache();
  return reservations;
};

const buildReservationFilter = (selector: ReservationSelectorInput): Record<string, unknown> => {
  if (selector.reservationIds?.length) {
    selector.reservationIds.forEach((id) => assertValidObjectId(id, 'reservation id'));

    return {
      _id: { $in: selector.reservationIds.map((id) => new Types.ObjectId(id)) },
      status: 'active',
    };
  }

  if (selector.orderId) {
    return {
      orderId: toObjectId(selector.orderId, 'orderId'),
      status: 'active',
    };
  }

  throw new InventoryServiceError('reservationIds or orderId is required', 400);
};

const transitionReservations = async (
  selector: ReservationSelectorInput,
  status: Exclude<InventoryReservationStatus, 'active'>,
  options: { allowEmpty?: boolean; session?: ClientSession } = {},
) => {
  const query = InventoryReservation.find(buildReservationFilter(selector));
  const reservations = await (options.session ? query.session(options.session) : query);
  const committedItems: Array<{
    productId: Types.ObjectId;
    variantId: Types.ObjectId;
    colorVariantId: Types.ObjectId;
    size: string;
    quantity: number;
  }> = [];

  if (!reservations.length && !options.allowEmpty) {
    throw new InventoryServiceError('Active reservation not found', 404);
  }

  for (const reservation of reservations) {
    if (status === 'committed') {
      const filter = {
        productId: reservation.productId,
        variantId: reservation.variantId,
        colorVariantId: reservation.colorVariantId,
        size: reservation.size,
        reservedQuantity: { $gte: reservation.quantity },
      };
      const update = {
        $inc: {
          quantity: -reservation.quantity,
          reservedQuantity: -reservation.quantity,
        },
      };

      const updatedInventory = options.session
        ? await Inventory.findOneAndUpdate(filter, update, {
            returnDocument: 'after',
            runValidators: true,
            session: options.session,
          })
        : await Inventory.findOneAndUpdate(filter, update, {
            returnDocument: 'after',
            runValidators: true,
          });
      if (!updatedInventory) {
        throw new InventoryServiceError('Active reservation inventory not found', 409);
      }
      await createMovement(
        updatedInventory,
        {
          quantityDelta: -reservation.quantity,
          reservedDelta: -reservation.quantity,
        },
        {
          type: 'sale_commit',
          reason: 'Hoàn tất giữ hàng',
          sourceId: reservation.orderId ?? null,
          sourceCode: reservation.orderId?.toString(),
          sourceType: 'order',
          session: options.session,
        },
      );
      committedItems.push({
        productId: reservation.productId,
        variantId: reservation.variantId,
        colorVariantId: reservation.colorVariantId,
        size: reservation.size,
        quantity: reservation.quantity,
      });
    } else {
      const filter = {
        productId: reservation.productId,
        variantId: reservation.variantId,
        colorVariantId: reservation.colorVariantId,
        size: reservation.size,
        reservedQuantity: { $gte: reservation.quantity },
      };
      const update = {
        $inc: {
          reservedQuantity: -reservation.quantity,
          availableQuantity: reservation.quantity,
        },
      };

      const updatedInventory = options.session
        ? await Inventory.findOneAndUpdate(filter, update, {
            returnDocument: 'after',
            runValidators: true,
            session: options.session,
          })
        : await Inventory.findOneAndUpdate(filter, update, {
            returnDocument: 'after',
            runValidators: true,
          });
      if (!updatedInventory) {
        throw new InventoryServiceError('Active reservation inventory not found', 409);
      }
      await createMovement(
        updatedInventory,
        {
          quantityDelta: 0,
          reservedDelta: -reservation.quantity,
          availableDelta: reservation.quantity,
        },
        {
          type: status === 'expired' ? 'reservation_expire' : 'reservation_release',
          reason: status === 'expired' ? 'Hết hạn giữ hàng' : 'Hủy giữ hàng',
          sourceId: reservation.orderId ?? null,
          sourceCode: reservation.orderId?.toString(),
          sourceType: 'order',
          session: options.session,
        },
      );
    }

    reservation.status = status;
    if (options.session) {
      await reservation.save({ session: options.session });
    } else {
      await reservation.save();
    }
  }

  if (committedItems.length) {
    await consumeImportRemainingQuantities(committedItems, options);
  }

  await invalidateProductCatalogCache();
  return reservations;
};

const releaseReservations = async (selector: ReservationSelectorInput, options: SessionOptions = {}) => {
  return transitionReservations(selector, 'released', options);
};

const commitReservations = async (selector: ReservationSelectorInput, options: SessionOptions = {}) => {
  return transitionReservations(selector, 'committed', options);
};

const expireReservations = async (now = new Date()) => {
  const reservations = await InventoryReservation.find({
    status: 'active',
    expiresAt: { $lte: now },
  });

  if (!reservations.length) {
    return [];
  }

  const expiredReservations = await transitionReservations(
    { reservationIds: reservations.map((reservation) => reservation._id.toString()) },
    'expired',
    { allowEmpty: true },
  );

  return expiredReservations;
};

const listSuppliers = async () => {
  return InventorySupplier.find().sort({ isActive: -1, name: 1 }).lean();
};

const createSupplier = async (input: UpsertInventorySupplierInput) => {
  const name = normalizeSupplierName(input.name);
  if (!name) {
    throw new InventoryServiceError('Supplier name is required', 400);
  }

  try {
    return await InventorySupplier.create({
      name,
      phone: normalizeShortText(input.phone, 40),
      email: normalizeShortText(input.email, 120).toLowerCase(),
      address: normalizeShortText(input.address, 300),
      note: normalizeLongText(input.note),
      isActive: input.isActive ?? true,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new InventoryServiceError('Supplier already exists', 409);
    }

    throw error;
  }
};

const updateSupplier = async (id: string, input: Partial<UpsertInventorySupplierInput>) => {
  assertValidObjectId(id, 'supplier id');
  const supplier = await InventorySupplier.findById(id);
  if (!supplier) {
    throw new InventoryServiceError('Supplier not found', 404);
  }

  if (input.name !== undefined) {
    const name = normalizeSupplierName(input.name);
    if (!name) {
      throw new InventoryServiceError('Supplier name is required', 400);
    }
    supplier.name = name;
  }
  if (input.phone !== undefined) supplier.phone = normalizeShortText(input.phone, 40);
  if (input.email !== undefined) supplier.email = normalizeShortText(input.email, 120).toLowerCase();
  if (input.address !== undefined) supplier.address = normalizeShortText(input.address, 300);
  if (input.note !== undefined) supplier.note = normalizeLongText(input.note);
  if (input.isActive !== undefined) supplier.isActive = Boolean(input.isActive);

  try {
    return await supplier.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new InventoryServiceError('Supplier already exists', 409);
    }

    throw error;
  }
};

const deleteSupplier = async (id: string) => {
  return updateSupplier(id, { isActive: false });
};

const buildStocktakeCode = () => {
  const timestamp = new Date().toISOString().slice(2, 19).replace(/\D/g, '');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();

  return `KK-${timestamp}-${suffix}`;
};

const createStocktake = async (input: CreateStocktakeInput, createdBy?: string) => {
  if (!input.lines?.length) {
    throw new InventoryServiceError('Stocktake lines are required', 400);
  }

  const createdById = createdBy ? toObjectId(createdBy, 'createdBy') : null;
  let stocktake: IInventoryStocktake | null = null;

  await runWithOptionalTransaction(async ({ session }) => {
      const seen = new Set<string>();
      const lines = [];

      for (const line of input.lines) {
        assertValidObjectId(line.inventoryId, 'inventoryId');
        assertPositiveInteger(line.countedQuantity, 'countedQuantity', 0);
        if (seen.has(line.inventoryId)) {
          throw new InventoryServiceError('Duplicate inventory item in stocktake', 400);
        }
        seen.add(line.inventoryId);

        const inventoryQuery = Inventory.findById(line.inventoryId);
        const inventory = await (session ? inventoryQuery.session(session) : inventoryQuery);
        if (!inventory) {
          throw new InventoryServiceError('Inventory item not found', 404);
        }
        if (line.countedQuantity < inventory.reservedQuantity) {
          throw new InventoryServiceError('countedQuantity cannot be lower than reservedQuantity', 400);
        }

        const difference = line.countedQuantity - inventory.quantity;
        lines.push({
          inventoryId: inventory._id,
          productId: inventory.productId,
          variantId: inventory.variantId,
          colorVariantId: inventory.colorVariantId,
          size: inventory.size,
          sku: inventory.sku,
          systemQuantity: inventory.quantity,
          countedQuantity: line.countedQuantity,
          difference,
          reason: normalizeShortText(line.reason || 'Kiểm kê kho'),
        });

        if (difference === 0) continue;

        const updatedInventory = await Inventory.findOneAndUpdate(
          { _id: inventory._id, reservedQuantity: { $lte: line.countedQuantity } },
          [
            {
              $set: {
                quantity: line.countedQuantity,
                availableQuantity: { $subtract: [line.countedQuantity, '$reservedQuantity'] },
              },
            },
          ],
          {
            returnDocument: 'after',
            runValidators: true,
            updatePipeline: true,
            ...(session ? { session } : {}),
          },
        );
        if (!updatedInventory) {
          throw new InventoryServiceError('countedQuantity cannot be lower than reservedQuantity', 400);
        }

        const selector = {
          productId: inventory.productId,
          variantId: inventory.variantId,
          colorVariantId: inventory.colorVariantId,
          size: inventory.size,
        };
        const unadjustedQuantity = await adjustImportRemainingQuantity(
          selector,
          Math.abs(difference),
          difference < 0 ? 'consume' : 'restore',
          { ...(session ? { session } : {}) },
        );
        if (difference < 0 && unadjustedQuantity > 0) {
          throw new InventoryServiceError('Cannot decrease inventory below remaining import lots', 409);
        }
        if (difference > 0 && unadjustedQuantity > 0) {
          await createAdjustmentImport(selector, unadjustedQuantity, { ...(session ? { session } : {}) });
        }

        await createMovement(
          updatedInventory,
          {
            quantityDelta: difference,
            availableDelta: difference,
          },
          {
            type: 'stocktake',
            reason: normalizeShortText(line.reason || 'Kiểm kê kho'),
            note: input.note,
            sourceCode: input.stocktakeCode,
            sourceType: 'stocktake',
            createdBy: createdById,
            ...(session ? { session } : {}),
          },
        );
      }

      const stocktakePayload = {
        stocktakeCode: normalizeReceiptCode(input.stocktakeCode) || buildStocktakeCode(),
        status: 'posted',
        note: normalizeLongText(input.note),
        lines,
        createdBy: createdById,
        postedAt: new Date(),
      };
      stocktake = session
        ? (await InventoryStocktake.create([stocktakePayload], { session }))[0]
        : await InventoryStocktake.create(stocktakePayload);
  });

  if (!stocktake) {
    throw new InventoryServiceError('Failed to create stocktake', 500);
  }

  return stocktake;
};

export const inventoryService = {
  createImport,
  createReceipt,
  getInventory,
  getLowStockInventory,
  getInventoryThreshold,
  getImports,
  getMovements,
  getReceipts,
  getReceiptById,
  getImportSuppliers,
  getImportById,
  updateInventoryThreshold,
  updateReceipt,
  confirmReceipt,
  cancelReceipt,
  deleteImport,
  adjustInventory,
  deleteInventory,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createStocktake,
  restoreImportRemainingQuantities,
  reserveInventory,
  releaseReservations,
  commitReservations,
  expireReservations,
};
