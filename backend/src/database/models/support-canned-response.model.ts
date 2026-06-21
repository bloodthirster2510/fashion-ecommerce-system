import { Schema, model, models, type Document, type Types } from 'mongoose';
import { SUPPORT_CATEGORIES, type SupportCategory } from './support-ticket.model';

export interface ISupportCannedResponse extends Document {
  title: string;
  body: string;
  category?: SupportCategory | null;
  isActive: boolean;
  useCount: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISupportCannedResponse>({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  body: { type: String, required: true, trim: true, minlength: 2, maxlength: 3000 },
  category: { type: String, enum: SUPPORT_CATEGORIES, default: null },
  isActive: { type: Boolean, default: true },
  useCount: { type: Number, default: 0, min: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

schema.index({ isActive: 1, category: 1, title: 1 });

export const SupportCannedResponse = models.SupportCannedResponse
  || model<ISupportCannedResponse>('SupportCannedResponse', schema);
