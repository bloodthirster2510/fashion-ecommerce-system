import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface ICartItem {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  size: string;
  sku: string;
  quantity: number;
  priceAtAddedTime: number;
  isSelected: boolean;
  recommendationRequestId?: string | null;
}

export interface ICart extends Document {
  user_id: Types.ObjectId;
  product_list: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const integerMinValidator = (min: number) => ({
  validator: (value: number) => Number.isInteger(value) && value >= min,
  message: `Value must be an integer greater than or equal to ${min}`,
});

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    colorVariantId: { type: Schema.Types.ObjectId, required: true },
    size: { type: String, required: true, trim: true, minlength: 1, maxlength: 10 },
    sku: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 80 },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: integerMinValidator(1),
    },
    priceAtAddedTime: { type: Number, required: true, min: 0 },
    isSelected: { type: Boolean, default: true },
    recommendationRequestId: { type: String, trim: true, maxlength: 120, default: null },
  },
  { _id: true },
);

const cartSchema = new Schema<ICart>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product_list: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

cartSchema.index({ user_id: 1 }, { unique: true });
cartSchema.index({ 'product_list.productId': 1, 'product_list.variantId': 1 });

export const Cart = models.Cart || model<ICart>('Cart', cartSchema);
