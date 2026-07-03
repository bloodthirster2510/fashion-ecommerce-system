import { Schema, model, models, type Document, type Types } from 'mongoose';
import type { PromptPolicyCategory } from '../../modules/virtual-try-on/prompt-policy/prompt-policy.types';

export type VirtualTryOnPromptViolationAction = 'warn' | 'temporary_block';

export interface IVirtualTryOnPromptViolation extends Document {
  userId: Types.ObjectId;
  prompt: string;
  reasonCode: string;
  matchedCategory?: PromptPolicyCategory;
  matchedRule?: string;
  action: VirtualTryOnPromptViolationAction;
  violationCount: number;
  blockedUntil?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const virtualTryOnPromptViolationSchema = new Schema<IVirtualTryOnPromptViolation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prompt: { type: String, required: true, trim: true, maxlength: 500 },
    reasonCode: { type: String, required: true, trim: true, maxlength: 80 },
    matchedCategory: { type: String, trim: true, maxlength: 80 },
    matchedRule: { type: String, trim: true, maxlength: 120 },
    action: {
      type: String,
      enum: ['warn', 'temporary_block'],
      required: true,
      index: true,
    },
    violationCount: { type: Number, required: true, min: 1 },
    blockedUntil: { type: Date, default: null, index: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      expires: 0,
    },
  },
  { timestamps: true },
);

virtualTryOnPromptViolationSchema.index({ userId: 1, createdAt: -1 });
virtualTryOnPromptViolationSchema.index({ userId: 1, action: 1, blockedUntil: 1 });

export const VirtualTryOnPromptViolation =
  models.VirtualTryOnPromptViolation ||
  model<IVirtualTryOnPromptViolation>('VirtualTryOnPromptViolation', virtualTryOnPromptViolationSchema);
