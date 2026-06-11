import { Schema, model, models, type Document, type Types } from 'mongoose';

export type CategoryGender = 'male' | 'female' | 'unisex';

export interface IMeasurementField {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  sortOrder: number;
}

export interface ICategoryFitType {
  _id: Types.ObjectId;
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ICategory extends Document {
  name: string;
  parent_id?: Types.ObjectId | null;
  level: number;
  gender: CategoryGender;
  image: string;
  bannerImage?: string | null;
  description: string;
  isLeaf: boolean;
  isSizeTemplateSource: boolean;
  sizeTemplateSourceId?: Types.ObjectId | null;
  sizes: string[];
  measurementFields: IMeasurementField[];
  fitTypes: ICategoryFitType[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const measurementFieldSchema = new Schema<IMeasurementField>(
  {
    key: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    label: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    unit: { type: String, required: true, trim: true, minlength: 1, maxlength: 30 },
    required: { type: Boolean, default: false },
    sortOrder: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const categoryFitTypeSchema = new Schema<ICategoryFitType>(
  {
    key: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    label: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    sortOrder: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    level: { type: Number, required: true, min: 1, max: 10 },
    gender: { type: String, enum: ['male', 'female', 'unisex'], required: true },
    image: { type: String, required: true, trim: true, maxlength: 500 },
    bannerImage: { type: String, default: null, trim: true, maxlength: 500 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    isLeaf: { type: Boolean, default: false },
    isSizeTemplateSource: { type: Boolean, default: false },
    sizeTemplateSourceId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    sizes: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => Array.isArray(value) && new Set(value.map((item) => item.trim().toLowerCase())).size === value.length,
        message: 'Sizes must be a unique array of non-empty strings',
      },
    },
    measurementFields: { type: [measurementFieldSchema], default: [] },
    fitTypes: { type: [categoryFitTypeSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ parent_id: 1 });
categorySchema.index({ gender: 1, isActive: 1 });
categorySchema.index({ sizeTemplateSourceId: 1 });
categorySchema.index({ name: 1, parent_id: 1, gender: 1 }, { unique: true });

export const Category = models.Category || model<ICategory>('Category', categorySchema);

