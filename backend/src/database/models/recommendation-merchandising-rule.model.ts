import { Schema, model, models, type Document, type Types } from 'mongoose';
import { RECOMMENDATION_CONTEXTS, type RecommendationContext } from './recommendation-event.model';

export interface IRecommendationMerchandisingRule extends Document {
  context: RecommendationContext;
  pinnedProductIds: Types.ObjectId[];
  enabled: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationMerchandisingRuleSchema = new Schema<IRecommendationMerchandisingRule>(
  {
    context: { type: String, enum: RECOMMENDATION_CONTEXTS, required: true, unique: true },
    pinnedProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product', required: true }],
    enabled: { type: Boolean, required: true, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const RecommendationMerchandisingRule =
  models.RecommendationMerchandisingRule ||
  model<IRecommendationMerchandisingRule>(
    'RecommendationMerchandisingRule',
    recommendationMerchandisingRuleSchema,
  );
