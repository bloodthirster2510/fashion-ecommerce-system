import { Schema, model, models, type Document, type Types } from 'mongoose';

export type CategoryGender = 'male' | 'female';

export interface ICategory extends Document {
  name: string;
  parent_id?: Types.ObjectId | null;
  level: number;
  gender: CategoryGender;
  image: string;
  bannerImage?: string | null;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    level: { type: Number, required: true, min: 1, max: 10 },
    gender: { type: String, enum: ['male', 'female'], required: true },
    image: { type: String, required: true, trim: true, maxlength: 500 },
    bannerImage: { type: String, default: null, trim: true, maxlength: 500 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

categorySchema.index({ parent_id: 1 });
categorySchema.index({ gender: 1, isActive: 1 });
categorySchema.index({ name: 1, parent_id: 1, gender: 1 }, { unique: true });

export const Category = models.Category || model<ICategory>('Category', categorySchema);

