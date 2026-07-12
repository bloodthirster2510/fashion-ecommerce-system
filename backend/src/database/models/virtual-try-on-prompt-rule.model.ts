import { Schema, model, models, type Document, type Types } from 'mongoose';
import type { PromptPolicyCategory } from '../../modules/virtual-try-on/prompt-policy/prompt-policy.types';

export interface IVirtualTryOnPromptRule extends Document {
  term: string;
  category: PromptPolicyCategory;
  reasonCode: string;
  enabled: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const promptPolicyCategories: PromptPolicyCategory[] = [
  'sexual_content',
  'violence',
  'prompt_injection',
  'personal_data',
  'hate_or_harassment',
  'unsafe_request',
];

const virtualTryOnPromptRuleSchema = new Schema<IVirtualTryOnPromptRule>(
  {
    term: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    category: { type: String, enum: promptPolicyCategories, required: true, index: true },
    reasonCode: { type: String, required: true, trim: true, maxlength: 80 },
    enabled: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

virtualTryOnPromptRuleSchema.index(
  { term: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);
virtualTryOnPromptRuleSchema.index({ enabled: 1, deletedAt: 1, updatedAt: -1 });

export const VirtualTryOnPromptRule =
  models.VirtualTryOnPromptRule ||
  model<IVirtualTryOnPromptRule>('VirtualTryOnPromptRule', virtualTryOnPromptRuleSchema);
