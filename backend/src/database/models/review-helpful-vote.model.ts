import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IReviewHelpfulVote extends Document {
  review_id: Types.ObjectId;
  user_id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reviewHelpfulVoteSchema = new Schema<IReviewHelpfulVote>(
  {
    review_id: { type: Schema.Types.ObjectId, ref: 'Review', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

reviewHelpfulVoteSchema.index({ review_id: 1, user_id: 1 }, { unique: true });
reviewHelpfulVoteSchema.index({ user_id: 1, createdAt: -1 });

export const ReviewHelpfulVote = models.ReviewHelpfulVote
  || model<IReviewHelpfulVote>('ReviewHelpfulVote', reviewHelpfulVoteSchema);
