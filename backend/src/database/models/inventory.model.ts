import { Schema, model, models, type Document, type Types } from 'mongoose';

export type InventoryReservationStatus = 'active' | 'committed' | 'released' | 'expired';

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
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  detail: IInventoryImportDetail[];
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

importDetailSchema.path('remainingQuantity').validate(function validateRemainingQuantity(
  this: IInventoryImportDetail,
  value: number,
) {
  return value <= this.quantity;
}, 'remainingQuantity cannot be greater than quantity');

const inventoryImportSchema = new Schema<IInventoryImport>(
  {
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
  },
  { timestamps: true },
);

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
inventorySchema.index({ productId: 1, variantId: 1, colorVariantId: 1, size: 1 }, { unique: true });
inventorySchema.index({ sku: 1 }, { unique: true });
inventorySchema.index({ availableQuantity: 1 });
inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ orderId: 1 });
inventoryReservationSchema.index({ userId: 1, status: 1 });

export const InventoryImport =
  models.Import || model<IInventoryImport>('Import', inventoryImportSchema);
export const Inventory =
  models.Inventory || model<IInventory>('Inventory', inventorySchema);
export const InventoryReservation =
  models.InventoryReservation ||
  model<IInventoryReservation>('InventoryReservation', inventoryReservationSchema);
