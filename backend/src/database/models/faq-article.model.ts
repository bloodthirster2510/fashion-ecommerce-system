import { Schema, model, models, type Document, type Types } from 'mongoose';

export const FAQ_CATEGORIES = [
  'orders',
  'shipping',
  'returns',
  'payments',
  'promotions',
  'loyalty',
  'account',
  'other',
] as const;

export type FaqCategory = typeof FAQ_CATEGORIES[number];

export interface IFaqArticle extends Document {
  question: string;
  answer: string;
  category: FaqCategory;
  keywords: string[];
  sortOrder: number;
  isPublished: boolean;
  publishedAt?: Date | null;
  helpfulCount: number;
  notHelpfulCount: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const faqArticleSchema = new Schema<IFaqArticle>(
  {
    question: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
    answer: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    category: { type: String, enum: FAQ_CATEGORIES, required: true, index: true },
    keywords: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 20,
        message: 'FAQ supports at most 20 keywords',
      },
    },
    sortOrder: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    helpfulCount: { type: Number, default: 0, min: 0 },
    notHelpfulCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

faqArticleSchema.index({ isPublished: 1, category: 1, sortOrder: 1 });
faqArticleSchema.index({ question: 'text', answer: 'text', keywords: 'text' });

export const FaqArticle = models.FaqArticle || model<IFaqArticle>('FaqArticle', faqArticleSchema);
