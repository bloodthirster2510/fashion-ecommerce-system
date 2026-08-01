import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  Inventory,
  InventoryImport,
  InventoryReceipt,
  InventoryReservation,
  Product,
  type IInventoryImport,
  type IInventoryImportDetail,
  type IInventoryReceipt,
  type IInventoryReceiptLineDetail,
  type IInventoryReservation,
  type IProductVariant,
  type InventoryReservationStatus,
} from '../../database/models';
import type {
  AdjustInventoryInput,
  CreateInventoryImportInput,
  CreateInventoryReceiptInput,
  InventoryImportDetailInput,
  InventoryImportListQueryInput,
  InventoryListQueryInput,
  InventoryReceiptLineInput,
  InventoryReceiptListQueryInput,
  InventoryReceiptStatus,
  InventoryReservationItemInput,
  ReservationSelectorInput,
  ReserveInventoryInput,
  UpdateInventoryReceiptInput,
} from './inventory.types';

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

type CreateImportOptions = SessionOptions & {
  importCode?: string;
  receiptId?: Types.ObjectId;
  receiptCode?: string;
};

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

const didMatchUpdate = (result: unknown) => {
  if (typeof result !== 'object' || result === null) {
    return true;
  }

  const matchedCount = (result as { matchedCount?: unknown }).matchedCount;
  return typeof matchedCount === 'number' ? matchedCount > 0 : true;
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

  for (const item of detail) {
    const sku = buildSku(input.productId, input.variantId, input.colorVariantId, item.size);

    await Inventory.findOneAndUpdate(
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
  }

  return createdImportRecord;
};

const createImport = async (input: CreateInventoryImportInput) => {
  const session = await mongoose.startSession();
  let importRecord: IInventoryImport | null = null;

  try {
    await session.withTransaction(async () => {
      importRecord = await createImportAndAdjustInventory(input, { session });
    });
  } finally {
    await session.endSession();
  }

  if (!importRecord) {
    throw new InventoryServiceError('Failed to create import', 500);
  }

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
  options: { session: ClientSession },
) => {
  const importDetails = importRecord.detail as InventoryImportDetailInput[];

  if (importDetails.some((item) => (item.remainingQuantity ?? item.quantity) < item.quantity)) {
    throw new InventoryServiceError('Cannot delete import because imported stock has been used or reserved', 409);
  }

  for (const item of importDetails) {
    const updateResult = await Inventory.updateOne(
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
      { session: options.session },
    );

    if (!didMatchUpdate(updateResult)) {
      throw new InventoryServiceError('Cannot delete import because imported stock has been used or reserved', 409);
    }
  }
};

const deleteImport = async (id: string) => {
  assertValidObjectId(id, 'import id');
  const session = await mongoose.startSession();
  let deletedImport: IInventoryImport | null = null;

  try {
    await session.withTransaction(async () => {
      const importRecord = await InventoryImport.findById(id, null, { session });
      if (!importRecord) {
        throw new InventoryServiceError('Import not found', 404);
      }

      if (importRecord.receiptId) {
        throw new InventoryServiceError('Cannot delete an import lot generated from a receipt', 409);
      }

      await decrementInventoryForImport(importRecord, { session });
      await importRecord.deleteOne({ session });
      deletedImport = importRecord;
    });
  } finally {
    await session.endSession();
  }

  if (!deletedImport) {
    throw new InventoryServiceError('Failed to delete import', 500);
  }

  return deletedImport;
};

const adjustInventory = async (id: string, input: AdjustInventoryInput) => {
  assertValidObjectId(id, 'inventory id');

  if (input.quantity === undefined && input.deltaQuantity === undefined) {
    throw new InventoryServiceError('quantity or deltaQuantity is required', 400);
  }

  if (input.quantity !== undefined && input.deltaQuantity !== undefined) {
    throw new InventoryServiceError('Use either quantity or deltaQuantity, not both', 400);
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
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
          session,
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
        { session },
      );

      if (deltaQuantity < 0 && unadjustedQuantity > 0) {
        throw new InventoryServiceError('Cannot decrease inventory below remaining import lots', 409);
      }

      if (deltaQuantity > 0 && unadjustedQuantity > 0) {
        await createAdjustmentImport(selector, unadjustedQuantity, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  return getInventoryByIdOrThrow(id);
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
};

const deleteInventory = async (id: string) => {
  const inventory = await getInventoryByIdOrThrow(id);

  if (inventory.reservedQuantity > 0) {
    throw new InventoryServiceError('Cannot delete inventory with active reservations', 409);
  }

  await inventory.deleteOne();
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
  await Promise.all(
    reservedItems.map((item) => {
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

      return options.session
        ? Inventory.updateOne(filter, update, { session: options.session })
        : Inventory.updateOne(filter, update);
    }),
  );
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

  const normalizedItems = await Promise.all(input.items.map((item) => normalizeReservationItem(item, options)));
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

      if (options.session) {
        await Inventory.updateOne(filter, update, { session: options.session });
      } else {
        await Inventory.updateOne(filter, update);
      }
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

      if (options.session) {
        await Inventory.updateOne(filter, update, { session: options.session });
      } else {
        await Inventory.updateOne(filter, update);
      }
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

  return reservations;
};

const releaseReservations = (selector: ReservationSelectorInput, options: SessionOptions = {}) => {
  return transitionReservations(selector, 'released', options);
};

const commitReservations = (selector: ReservationSelectorInput, options: SessionOptions = {}) => {
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

  return transitionReservations(
    { reservationIds: reservations.map((reservation) => reservation._id.toString()) },
    'expired',
    { allowEmpty: true },
  );
};

export const inventoryService = {
  createImport,
  createReceipt,
  getInventory,
  getLowStockInventory,
  getImports,
  getReceipts,
  getReceiptById,
  getImportSuppliers,
  getImportById,
  updateReceipt,
  confirmReceipt,
  cancelReceipt,
  deleteImport,
  adjustInventory,
  deleteInventory,
  restoreImportRemainingQuantities,
  reserveInventory,
  releaseReservations,
  commitReservations,
  expireReservations,
};
