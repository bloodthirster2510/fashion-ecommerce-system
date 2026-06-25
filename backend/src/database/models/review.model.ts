import { Schema, model, models, type Document, type Types } from 'mongoose';

export type ReviewModerationStatus = 'pending' | 'visible' | 'hidden';
export type ReviewSizeFit = 'small' | 'true_to_size' | 'large';
export type ReviewModerationAction = 'auto_pending' | 'approved' | 'hidden' | 'restored';

export interface IReviewCriteria {
  productQuality?: number;
  descriptionMatch?: number;
  sizeFit?: ReviewSizeFit;
}

export interface IReviewImage {
  _id: Types.ObjectId;
  url: string;
  thumbnailUrl: string;
  publicId?: string | null;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  width?: number | null;
  height?: number | null;
}

export interface IReviewModerationEvent {
  action: ReviewModerationAction;
  fromStatus: ReviewModerationStatus;
  toStatus: ReviewModerationStatus;
  reason?: string | null;
  actorId?: Types.ObjectId | null;
  actorRole: 'system' | 'admin' | 'staff';
  createdAt: Date;
}

export interface IReview extends Document {
  user_id: Types.ObjectId;
  product_id: Types.ObjectId;
  order_id: Types.ObjectId;
  order_item_id: Types.ObjectId;
  rating: number;
  comment: string;
  criteria?: IReviewCriteria | null;
  images: Array<IReviewImage | string>;
  moderationStatus: ReviewModerationStatus;
  moderationReasons: string[];
  moderationHistory: IReviewModerationEvent[];
  helpfulCount: number;
  adminReply?: string | null;
  repliedAt?: Date | null;
  repliedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const optionalRating = {
  type: Number,
  min: 1,
  max: 5,
  validate: {
    validator: (value: number | undefined) => value === undefined || Number.isInteger(value),
    message: 'Criteria rating must be an integer',
  },
};

const reviewCriteriaSchema = new Schema<IReviewCriteria>(
  {
    productQuality: optionalRating,
    descriptionMatch: optionalRating,
    sizeFit: { type: String, enum: ['small', 'true_to_size', 'large'] },
  },
  { _id: false },
);

const moderationEventSchema = new Schema<IReviewModerationEvent>(
  {
    action: {
      type: String,
      enum: ['auto_pending', 'approved', 'hidden', 'restored'],
      required: true,
    },
    fromStatus: { type: String, enum: ['pending', 'visible', 'hidden'], required: true },
    toStatus: { type: String, enum: ['pending', 'visible', 'hidden'], required: true },
    reason: { type: String, trim: true, default: null, maxlength: 500 },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, enum: ['system', 'admin', 'staff'], required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const reviewImageSchema = new Schema<IReviewImage>(
  {
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    thumbnailUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    publicId: { type: String, trim: true, default: null, maxlength: 500 },
    mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    size: { type: Number, required: true, min: 0 },
    width: { type: Number, default: null, min: 1 },
    height: { type: Number, default: null, min: 1 },
  },
  { _id: true },
);

const reviewSchema = new Schema<IReview>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    order_item_id: { type: Schema.Types.ObjectId, required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer',
      },
    },
    comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    criteria: { type: reviewCriteriaSchema, default: null },
    images: { type: [reviewImageSchema], default: [] },
    moderationStatus: {
      type: String,
      enum: ['pending', 'visible', 'hidden'],
      default: 'visible',
      index: true,
    },
    moderationReasons: [{ type: String, trim: true }],
    moderationHistory: { type: [moderationEventSchema], default: [] },
    helpfulCount: { type: Number, default: 0, min: 0 },
    adminReply: { type: String, trim: true, maxlength: 2000, default: null },
    repliedAt: { type: Date, default: null },
    repliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Một dòng hàng đã mua chỉ có một review, nhưng khách mua lại cùng sản phẩm ở đơn khác vẫn được review.
reviewSchema.index({ order_id: 1, order_item_id: 1 }, { unique: true });
reviewSchema.index({ product_id: 1, moderationStatus: 1, createdAt: -1 });
reviewSchema.index({ user_id: 1, createdAt: -1 });
reviewSchema.index({ moderationStatus: 1, createdAt: -1 });

export const Review = models.Review || model<IReview>('Review', reviewSchema);
