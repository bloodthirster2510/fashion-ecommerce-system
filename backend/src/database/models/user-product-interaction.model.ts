import { Schema, model, models, type Document, type Types } from 'mongoose';

export const INTERACTION_ACTION_TYPES = [
  'view',
  'search',
  'favorite',
  'add_to_cart',
  'purchase',
] as const;

export type InteractionActionType = (typeof INTERACTION_ACTION_TYPES)[number];

export const INTERACTION_SOURCES = [
  'home',
  'product_list',
  'product_detail',
  'search',
  'cart',
  'checkout',
  'backend',
] as const;

export type InteractionSource = (typeof INTERACTION_SOURCES)[number];

export interface IUserProductInteraction extends Document {
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  productId?: Types.ObjectId | null;
  actionType: InteractionActionType;
  weight: number;
  source: InteractionSource;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const userProductInteractionSchema = new Schema<IUserProductInteraction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, trim: true, maxlength: 128, default: null },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    actionType: {
      type: String,
      enum: INTERACTION_ACTION_TYPES,
      required: true,
    },
    weight: { type: Number, required: true, min: 0 },
    source: {
      type: String,
      enum: INTERACTION_SOURCES,
      required: true,
      default: 'backend',
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

userProductInteractionSchema.index({ userId: 1, createdAt: -1 });
userProductInteractionSchema.index({ sessionId: 1, createdAt: -1 });
userProductInteractionSchema.index({ productId: 1, actionType: 1, createdAt: -1 });
userProductInteractionSchema.index({ userId: 1, productId: 1, actionType: 1, createdAt: -1 });
userProductInteractionSchema.index({ sessionId: 1, productId: 1, actionType: 1, createdAt: -1 });

export const UserProductInteraction =
  models.UserProductInteraction ||
  model<IUserProductInteraction>('UserProductInteraction', userProductInteractionSchema);
