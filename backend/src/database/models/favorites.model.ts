import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IFavorite extends Document {
  user_id: Types.ObjectId;
  product_id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteSchema = new Schema<IFavorite>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ user_id: 1, product_id: 1 }, { unique: true });
favoriteSchema.index({ user_id: 1, createdAt: -1 });

export const Favorite = models.Favorite || model<IFavorite>('Favorite', favoriteSchema);
