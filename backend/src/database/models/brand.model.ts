import { Schema, model, models, type Document } from 'mongoose';

export interface IBrand extends Document {
  name: string;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      match: /^[a-zA-Z0-9\s&.'-]+$/,
    },
    image: { type: String, required: true, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

brandSchema.index({ name: 1 }, { unique: true });
brandSchema.index({ isActive: 1 });

export const Brand = models.Brand || model<IBrand>('Brand', brandSchema);

