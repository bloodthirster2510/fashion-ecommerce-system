import { Schema, model, models, type Document, type Types } from 'mongoose';
import {
  RECOMMENDATION_CONTEXTS,
  type RecommendationContext,
} from './recommendation-event.model';

export interface IRecommendationRequestItem {
  productId: Types.ObjectId;
  score: number;
  rank: number;
  reasonCodes: string[];
}

export interface IRecommendationRequest extends Document {
  requestId: string;
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  context: RecommendationContext;
  sourceProductId?: Types.ObjectId | null;
  algorithmVersion: string;
  fallbackUsed: boolean;
  items: IRecommendationRequestItem[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationRequestItemSchema = new Schema<IRecommendationRequestItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    score: { type: Number, required: true, min: 0 },
    rank: { type: Number, required: true, min: 1 },
    reasonCodes: { type: [String], default: [] },
  },
  { _id: false },
);

const recommendationRequestSchema = new Schema<IRecommendationRequest>(
  {
    requestId: { type: String, required: true, trim: true, maxlength: 120 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, trim: true, maxlength: 128, default: null },
    context: { type: String, enum: RECOMMENDATION_CONTEXTS, required: true },
    sourceProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    algorithmVersion: { type: String, required: true, trim: true, maxlength: 80 },
    fallbackUsed: { type: Boolean, required: true, default: false },
    items: { type: [recommendationRequestItemSchema], default: [] },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

recommendationRequestSchema.index({ requestId: 1 }, { unique: true });
recommendationRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
recommendationRequestSchema.index({ userId: 1, createdAt: -1 });
recommendationRequestSchema.index({ sessionId: 1, createdAt: -1 });

export const RecommendationRequest =
  models.RecommendationRequest ||
  model<IRecommendationRequest>('RecommendationRequest', recommendationRequestSchema);
