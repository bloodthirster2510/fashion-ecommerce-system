import { Schema, model, models, type Document, type Types } from 'mongoose';

export type ProductVisualImageSource = 'product_image' | 'color_variant_image';
export type ProductVisualGender = 'male' | 'female' | 'unisex';

export interface IProductVisualIndex extends Document {
  galleryImageId: string;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | null;
  colorVariantId?: Types.ObjectId | null;
  imageUrl: string;
  imageHash: string;
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  embeddingVersion: string;
  categoryId?: Types.ObjectId | null;
  brandId?: Types.ObjectId | null;
  gender?: ProductVisualGender | null;
  color?: string | null;
  price?: number | null;
  discount?: number | null;
  finalPrice?: number | null;
  isActive: boolean;
  availableQuantity: number;
  source: ProductVisualImageSource;
  indexedAt: Date;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Collection lưu embedding của từng ảnh sản phẩm để tìm ảnh tương tự nhanh hơn.
const productVisualIndexSchema = new Schema<IProductVisualIndex>(
  {
    galleryImageId: { type: String, required: true, trim: true, maxlength: 180 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, default: null },
    colorVariantId: { type: Schema.Types.ObjectId, default: null },
    imageUrl: { type: String, required: true, trim: true, maxlength: 700 },
    imageHash: { type: String, required: true, trim: true, maxlength: 128 },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        // Mỗi ảnh phải có vector embedding thì mới có thể so sánh với ảnh truy vấn.
        validator: (value: number[]) => Array.isArray(value) && value.length > 0,
        message: 'Embedding must contain at least one number',
      },
    },
    embeddingDimension: { type: Number, required: true, min: 1 },
    embeddingModel: { type: String, required: true, trim: true, maxlength: 80 },
    embeddingVersion: { type: String, required: true, trim: true, maxlength: 40 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null },
    gender: { type: String, enum: ['male', 'female', 'unisex'], default: null },
    color: { type: String, trim: true, maxlength: 80, default: null },
    price: { type: Number, min: 0, default: null },
    discount: { type: Number, min: 0, max: 100, default: null },
    finalPrice: { type: Number, min: 0, default: null },
    isActive: { type: Boolean, required: true, default: true },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    source: {
      type: String,
      enum: ['product_image', 'color_variant_image'],
      required: true,
    },
    indexedAt: { type: Date, required: true, default: Date.now },
    lastSyncedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

// Mỗi ảnh trong cùng phiên bản model chỉ có một bản ghi index.
productVisualIndexSchema.index(
  { galleryImageId: 1, embeddingModel: 1, embeddingVersion: 1 },
  { unique: true },
);
// Các index bên dưới phục vụ lọc nhanh theo sản phẩm, danh mục, thương hiệu, màu và phiên bản model.
productVisualIndexSchema.index({ productId: 1, isActive: 1 });
productVisualIndexSchema.index({ imageHash: 1, embeddingModel: 1, embeddingVersion: 1 });
productVisualIndexSchema.index({ isActive: 1, categoryId: 1 });
productVisualIndexSchema.index({ isActive: 1, brandId: 1 });
productVisualIndexSchema.index({ isActive: 1, color: 1 });
productVisualIndexSchema.index({ embeddingModel: 1, embeddingVersion: 1, lastSyncedAt: -1 });

export const ProductVisualIndex =
  models.ProductVisualIndex ||
  model<IProductVisualIndex>('ProductVisualIndex', productVisualIndexSchema);
