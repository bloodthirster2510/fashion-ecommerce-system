import { Schema, model, models, type Document, type Types } from 'mongoose';
import { normalizeVietnamese } from '../../modules/catalog/products/search.util';

export interface IMeasurementValue {
  key: string;
  value: number;
}

export interface IProductSizeMeasurement {
  size: string;
  measurements: IMeasurementValue[];
}

export interface IColorVariant {
  _id: Types.ObjectId;
  color: string;
  colorCode?: string;
  image: string;
}

export interface IProductVariant {
  _id: Types.ObjectId;
  fitTypeId: Types.ObjectId;
  price: number;
  discount: number;
  sizeMeasurements: IProductSizeMeasurement[];
  colors: IColorVariant[];
  isActive: boolean;
}

export interface IProduct extends Document {
  category_id: Types.ObjectId;
  name: string;
  brand_id: Types.ObjectId;
  variant: IProductVariant[];
  description: string;
  material: string;
  materialNormalized: string;
  product_image: string;
  isActive: boolean;
  sold_quantity: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const measurementValueSchema = new Schema<IMeasurementValue>(
  {
    key: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const sizeMeasurementSchema = new Schema<IProductSizeMeasurement>(
  {
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    measurements: {
      type: [measurementValueSchema],
      default: [],
    },
  },
  { _id: false },
);

const colorVariantSchema = new Schema<IColorVariant>(
  {
    color: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    colorCode: { type: String, trim: true, maxlength: 30 },
    image: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: true },
);

const productVariantSchema = new Schema<IProductVariant>(
  {
    fitTypeId: { type: Schema.Types.ObjectId, required: true },
    price: { type: Number, required: true, min: 1000, max: 100000000 },
    discount: { type: Number, required: true, min: 0, max: 100 },
    sizeMeasurements: {
      type: [sizeMeasurementSchema],
      required: true,
      validate: {
        validator: (value: IProductSizeMeasurement[]) => value.length > 0,
        message: 'Product variant must have at least one size',
      },
    },
    colors: {
      type: [colorVariantSchema],
      required: true,
      validate: {
        validator: (value: IColorVariant[]) => value.length > 0,
        message: 'Product variant must have at least one color option',
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const productSchema = new Schema<IProduct>(
  {
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
    brand_id: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
    variant: {
      type: [productVariantSchema],
      default: [],
    },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    material: { type: String, trim: true, maxlength: 200, default: '' },
    materialNormalized: { type: String, trim: true, select: false, default: '' },
    product_image: { type: String, required: true, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    sold_quantity: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

productSchema.index({ category_id: 1, isActive: 1 });
productSchema.index({ brand_id: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ 'variant.fitTypeId': 1 });
productSchema.index({ 'variant.colors.color': 1 });
productSchema.index({ materialNormalized: 1 });

productSchema.pre('save', function () {
  if (this.isModified('material')) {
    this.materialNormalized = this.material ? normalizeVietnamese(this.material) : '';
  }
});

export const Product = models.Product || model<IProduct>('Product', productSchema);

