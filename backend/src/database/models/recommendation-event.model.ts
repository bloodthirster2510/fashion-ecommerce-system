import { Schema, model, models, type Document, type Types } from 'mongoose';

export const RECOMMENDATION_CONTEXTS = [
  'home',
  'product_detail_similar',
  'cart',
] as const;

export type RecommendationContext = (typeof RECOMMENDATION_CONTEXTS)[number];

export const RECOMMENDATION_EVENT_TYPES = [
  'impression',
  'click',
  'add_to_cart',
  'purchase',
] as const;

export type RecommendationEventType = (typeof RECOMMENDATION_EVENT_TYPES)[number];

export interface IRecommendationEvent extends Document {
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  context: RecommendationContext;
  sourceProductId?: Types.ObjectId | null;
  recommendedProductId: Types.ObjectId;
  algorithmVersion: string;
  score: number;
  rank: number;
  reasonCodes: string[];
  eventType: RecommendationEventType;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationEventSchema = new Schema<IRecommendationEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, trim: true, maxlength: 128, default: null },
    context: {
      type: String,
      enum: RECOMMENDATION_CONTEXTS,
      required: true,
    },
    sourceProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    recommendedProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    algorithmVersion: { type: String, required: true, trim: true, maxlength: 80 },
    score: { type: Number, required: true, min: 0, default: 0 },
    rank: { type: Number, required: true, min: 0, default: 0 },
    reasonCodes: { type: [String], default: [] },
    eventType: {
      type: String,
      enum: RECOMMENDATION_EVENT_TYPES,
      required: true,
    },
    requestId: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);

recommendationEventSchema.index(
  { requestId: 1, recommendedProductId: 1, eventType: 1 },
  { unique: true },
);
recommendationEventSchema.index({ userId: 1, context: 1, createdAt: -1 });
recommendationEventSchema.index({ sessionId: 1, context: 1, createdAt: -1 });
recommendationEventSchema.index({ recommendedProductId: 1, eventType: 1, createdAt: -1 });

export const RecommendationEvent =
  models.RecommendationEvent ||
  model<IRecommendationEvent>('RecommendationEvent', recommendationEventSchema);
