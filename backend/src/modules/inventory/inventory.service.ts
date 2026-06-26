import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  Inventory,
  InventoryImport,
  InventoryReservation,
  Product,
  type IInventoryImport,
  type IInventoryImportDetail,
  type IInventoryReservation,
  type IProductVariant,
  type InventoryReservationStatus,
} from '../../database/models';
import type {
  AdjustInventoryInput,
  CreateInventoryImportInput,
  InventoryImportDetailInput,
  InventoryImportListQueryInput,
  InventoryListQueryInput,
  InventoryReservationItemInput,
  ReservationSelectorInput,
  ReserveInventoryInput,
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

type SessionOptions = {
  session?: ClientSession;
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

const assertPositiveInteger = (value: number, fieldName: string, min = 1) => {
  if (!Number.isInteger(value) || value < min) {
    throw new InventoryServiceError(`${fieldName} must be an integer greater than or equal to ${min}`, 400);
  }
};

const clampPagination = (query: InventoryListQueryInput | InventoryImportListQueryInput) => {
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

    assertPositiveInteger(detail.quantity, 'Import detail quantity');

    const remainingQuantity = detail.remainingQuantity ?? detail.quantity;
    assertPositiveInteger(remainingQuantity, 'Import detail remainingQuantity', 0);

    if (remainingQuantity > detail.quantity) {
      throw new InventoryServiceError('Import detail remainingQuantity cannot be greater than quantity', 400);
    }

    if (detail.importPrice !== undefined && detail.importPrice < 0) {
      throw new InventoryServiceError('Import detail importPrice must be greater than or equal to 0', 400);
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
  assertValidObjectId(variantId, 'variantId');
  assertValidObjectId(colorVariantId, 'colorVariantId');
  const query = Product.findById(productObjectId);
  const product = await (options.session ? query.session(options.session) : query);

  if (!product) {
    throw new InventoryServiceError('Product not found', 404);
  }

  if (options.requireSellable && !product.isActive) {
    throw new InventoryServiceError('Product is not active', 400);
  }

  const variant = product.variant.find((item: IProductVariant) => toIdString(item._id) === variantId);
  if (!variant) {
    throw new InventoryServiceError('Variant not found in product', 404);
  }

  if (options.requireSellable && !variant.isActive) {
    throw new InventoryServiceError('Variant is not active', 400);
  }

  const color = variant.colors.find((item: IProductVariant['colors'][number]) => toIdString(item._id) === colorVariantId);
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

const createImport = async (input: CreateInventoryImportInput) => {
  const productId = toObjectId(input.productId, 'productId');
  const variantId = toObjectId(input.variantId, 'variantId');
  const colorVariantId = toObjectId(input.colorVariantId, 'colorVariantId');
  const detail = normalizeImportDetails(input.detail);
  const supplierName = normalizeSupplierName(input.supplierName);

  await Promise.all(
    detail.map((item) =>
      findProductSelection(input.productId, input.variantId, input.colorVariantId, item.size),
    ),
  );

  const importPayload = {
    importCode: buildImportCode(),
    supplierName,
    productId,
    variantId,
    colorVariantId,
    detail,
    totalAmount: getImportTotalAmount(detail),
  };
  const session = await mongoose.startSession();
  let importRecord: IInventoryImport | null = null;

  try {
    await session.withTransaction(async () => {
      const [createdImportRecord] = await InventoryImport.create([importPayload], { session });

      importRecord = createdImportRecord;

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
            session,
          },
        );
      }
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
          { session },
        );

        if (!didMatchUpdate(updateResult)) {
          throw new InventoryServiceError('Cannot delete import because imported stock has been used or reserved', 409);
        }
      }

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

  if (deltaQuantity !== 0) {
    await adjustImportRemainingQuantity(
      {
        productId: previousInventory.productId,
        variantId: previousInventory.variantId,
        colorVariantId: previousInventory.colorVariantId,
        size: previousInventory.size,
      },
      Math.abs(deltaQuantity),
      deltaQuantity < 0 ? 'consume' : 'restore',
    );
  }

  return getInventoryByIdOrThrow(id);
};

const buildImportCode = () => {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/\D/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `IMP-${timestamp}-${suffix}`;
};

const getImportTotalAmount = (details: Array<{ quantity: number; importPrice?: number }>) =>
  details.reduce((sum, detail) => sum + detail.quantity * (detail.importPrice ?? 0), 0);

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
) => {
  let remaining = quantity;
  const query = InventoryImport.find({
    productId: selector.productId,
    variantId: selector.variantId,
    colorVariantId: selector.colorVariantId,
    'detail.size': selector.size,
  }).sort({ createdAt: mode === 'consume' ? 1 : -1 });
  const imports = await (options.session ? query.session(options.session) : query);

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

  // Manual stock adjustments can make inventory quantity diverge from import lots.
  // Keep lot counters bounded, but never block checkout/restock for stock that
  // legitimately exists outside import history.
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
  getInventory,
  getLowStockInventory,
  getImports,
  getImportSuppliers,
  getImportById,
  deleteImport,
  adjustInventory,
  deleteInventory,
  restoreImportRemainingQuantities,
  reserveInventory,
  releaseReservations,
  commitReservations,
  expireReservations,
};
