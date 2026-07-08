import { Schema, model, models, type Document, type Types } from 'mongoose';

export type InventoryReservationStatus = 'active' | 'committed' | 'released' | 'expired';
export type InventoryReceiptStatus = 'draft' | 'confirmed' | 'cancelled';

export interface IInventory extends Document {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  size: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryImportDetail {
  size: string;
  quantity: number;
  remainingQuantity: number;
  importPrice?: number;
}

export interface IInventoryImport extends Document {
  importCode: string;
  receiptId?: Types.ObjectId | null;
  receiptCode?: string;
  supplierName?: string;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  detail: IInventoryImportDetail[];
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryReceiptLineDetail {
  size: string;
  quantity: number;
  importPrice?: number;
}

export interface IInventoryReceiptLine {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  detail: IInventoryReceiptLineDetail[];
}

export interface IInventoryReceipt extends Document {
  receiptCode: string;
  supplierName?: string;
  importDate: Date;
  createdBy?: Types.ObjectId | null;
  status: InventoryReceiptStatus;
  note?: string;
  lines: IInventoryReceiptLine[];
  totalQuantity: number;
  totalAmount: number;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryReservation extends Document {
  userId: Types.ObjectId;
  orderId?: Types.ObjectId | null;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  size: string;
  sku: string;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const integerMinValidator = (min: number) => ({
  validator: (value: number) => Number.isInteger(value) && value >= min,
  message: `Value must be an integer greater than or equal to ${min}`,
});

const importDetailSchema = new Schema<IInventoryImportDetail>(
  {
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: integerMinValidator(1),
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: integerMinValidator(0),
    },
    importPrice: { type: Number, min: 0 },
  },
  { _id: false },
);

const receiptLineDetailSchema = new Schema<IInventoryReceiptLineDetail>(
  {
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: integerMinValidator(1),
    },
    importPrice: { type: Number, min: 0 },
  },
  { _id: false },
);

const receiptLineSchema = new Schema<IInventoryReceiptLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    detail: {
      type: [receiptLineDetailSchema],
      required: true,
      validate: {
        validator: (value: IInventoryReceiptLineDetail[]) => value.length > 0,
        message: 'Receipt line must include at least one detail',
      },
    },
  },
  { _id: false },
);

const buildImportCode = () => {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/\D/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `IMP-${timestamp}-${suffix}`;
};

importDetailSchema.path('remainingQuantity').validate(function validateRemainingQuantity(
  this: IInventoryImportDetail,
  value: number,
) {
  return value <= this.quantity;
}, 'remainingQuantity cannot be greater than quantity');

const inventoryImportSchema = new Schema<IInventoryImport>(
  {
    importCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      unique: true,
      default: buildImportCode,
    },
    receiptId: { type: Schema.Types.ObjectId, ref: 'InventoryReceipt', default: null },
    receiptCode: { type: String, trim: true, uppercase: true, maxlength: 40, default: '' },
    supplierName: { type: String, trim: true, maxlength: 120, default: '' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    detail: {
      type: [importDetailSchema],
      required: true,
      validate: {
        validator: (value: IInventoryImportDetail[]) => value.length > 0,
        message: 'Import must include at least one detail line',
      },
    },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

inventoryImportSchema.path('totalAmount').validate(function validateTotalAmount(
  this: IInventoryImport,
  value: number,
) {
  const expectedTotal = this.detail.reduce(
    (sum, item) => sum + item.quantity * (item.importPrice ?? 0),
    0,
  );

  return value === expectedTotal;
}, 'totalAmount must equal import detail quantity multiplied by importPrice');

const inventoryReceiptSchema = new Schema<IInventoryReceipt>(
  {
    receiptCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      unique: true,
    },
    supplierName: { type: String, trim: true, maxlength: 120, default: '' },
    importDate: { type: Date, required: true, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'cancelled'],
      default: 'draft',
      required: true,
    },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    lines: { type: [receiptLineSchema], default: [] },
    totalQuantity: { type: Number, required: true, default: 0, min: 0, validate: integerMinValidator(0) },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

inventoryReceiptSchema.path('totalQuantity').validate(function validateReceiptTotalQuantity(
  this: IInventoryReceipt,
  value: number,
) {
  const expectedTotal = this.lines.reduce(
    (sum, line) => sum + line.detail.reduce((lineSum, item) => lineSum + item.quantity, 0),
    0,
  );

  return value === expectedTotal;
}, 'totalQuantity must equal receipt detail quantities');

inventoryReceiptSchema.path('totalAmount').validate(function validateReceiptTotalAmount(
  this: IInventoryReceipt,
  value: number,
) {
  const expectedTotal = this.lines.reduce(
    (sum, line) =>
      sum + line.detail.reduce((lineSum, item) => lineSum + item.quantity * (item.importPrice ?? 0), 0),
    0,
  );

  return value === expectedTotal;
}, 'totalAmount must equal receipt detail quantity multiplied by importPrice');

const inventorySchema = new Schema<IInventory>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    sku: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 80 },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: integerMinValidator(0),
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: integerMinValidator(0),
    },
    availableQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: integerMinValidator(0),
    },
  },
  { timestamps: true },
);

inventorySchema.path('availableQuantity').validate(function validateAvailableQuantity(
  this: IInventory,
  value: number,
) {
  return value === this.quantity - this.reservedQuantity;
}, 'availableQuantity must equal quantity minus reservedQuantity');

inventorySchema.path('reservedQuantity').validate(function validateReservedQuantity(
  this: IInventory,
  value: number,
) {
  return value <= this.quantity;
}, 'reservedQuantity cannot be greater than quantity');

const inventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    sku: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 80 },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: integerMinValidator(1),
    },
    status: {
      type: String,
      enum: ['active', 'committed', 'released', 'expired'],
      default: 'active',
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

inventoryImportSchema.index({ productId: 1, variantId: 1, colorVariantId: 1, createdAt: -1 });
inventoryImportSchema.index({ supplierName: 1 });
inventoryImportSchema.index({ receiptId: 1 });
inventoryImportSchema.index({ receiptCode: 1 });
inventoryReceiptSchema.index({ status: 1, importDate: -1 });
inventoryReceiptSchema.index({ supplierName: 1 });
inventorySchema.index({ productId: 1, variantId: 1, colorVariantId: 1, size: 1 }, { unique: true });
inventorySchema.index({ sku: 1 }, { unique: true });
inventorySchema.index({ availableQuantity: 1 });
inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ orderId: 1 });
inventoryReservationSchema.index({ userId: 1, status: 1 });

export const InventoryImport =
  models.Import || model<IInventoryImport>('Import', inventoryImportSchema);
export const InventoryReceipt =
  models.InventoryReceipt || model<IInventoryReceipt>('InventoryReceipt', inventoryReceiptSchema);
export const Inventory =
  models.Inventory || model<IInventory>('Inventory', inventorySchema);
export const InventoryReservation =
  models.InventoryReservation ||
  model<IInventoryReservation>('InventoryReservation', inventoryReservationSchema);
