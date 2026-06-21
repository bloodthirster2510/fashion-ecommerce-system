import { Schema, model, models, type Document, type Types } from 'mongoose';

export type FaqVoteValue = 'helpful' | 'not_helpful';

export interface IFaqVote extends Document {
  faqId: Types.ObjectId;
  userId: Types.ObjectId;
  value: FaqVoteValue;
  createdAt: Date;
  updatedAt: Date;
}

const faqVoteSchema = new Schema<IFaqVote>(
  {
    faqId: { type: Schema.Types.ObjectId, ref: 'FaqArticle', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: String, enum: ['helpful', 'not_helpful'], required: true },
  },
  { timestamps: true },
);

faqVoteSchema.index({ faqId: 1, userId: 1 }, { unique: true });

export const FaqVote = models.FaqVote || model<IFaqVote>('FaqVote', faqVoteSchema);
