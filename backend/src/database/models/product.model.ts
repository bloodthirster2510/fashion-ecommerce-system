import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IProductSizeSpec {
  size: string;
  shoulder: number;
  chest: number;
  length: number;
  weight: number;
  stock_quantity: number;
}

export interface IProductVersion {
  _id: Types.ObjectId;
  sku: string;
  color: string;
  fitType: string;
  size_spec: IProductSizeSpec[];
  version_image: string;
  image_embedding: number[];
  price: number;
  discount: number;
  isAvailable: boolean;
  import: Types.ObjectId[];
}

export interface IProduct extends Document {
  category_id: Types.ObjectId;
  name: string;
  brand_id: Types.ObjectId;
  version: IProductVersion[];
  description: string;
  product_image: string;
  isActive: boolean;
  sold_quantity: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const sizeSpecSchema = new Schema<IProductSizeSpec>(
  {
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    shoulder: { type: Number, required: true, min: 0 },
    chest: { type: Number, required: true, min: 0 },
    length: { type: Number, required: true, min: 0 },
    weight: { type: Number, required: true, min: 0 },
    stock_quantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const productVersionSchema = new Schema<IProductVersion>(
  {
    sku: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    color: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    fitType: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    size_spec: {
      type: [sizeSpecSchema],
      required: true,
      validate: {
        validator: (value: IProductSizeSpec[]) => value.length > 0,
        message: 'Product version must have at least one size specification',
      },
    },
    version_image: { type: String, required: true, trim: true, maxlength: 500 },
    image_embedding: { type: [Number], default: [] },
    price: { type: Number, required: true, min: 1000, max: 100000000 },
    discount: { type: Number, required: true, min: 0, max: 100 },
    isAvailable: { type: Boolean, default: true },
    import: [{ type: Schema.Types.ObjectId, ref: 'Import' }],
  },
  { _id: true },
);

const productSchema = new Schema<IProduct>(
  {
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
    brand_id: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
    version: {
      type: [productVersionSchema],
      default: [],
    },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
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
productSchema.index({ 'version.sku': 1 }, { unique: true });

export const Product = models.Product || model<IProduct>('Product', productSchema);

