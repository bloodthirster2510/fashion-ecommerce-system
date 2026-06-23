import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface IReview extends Document {
  user_id: Types.ObjectId;
  product_id: Types.ObjectId;
  order_id: Types.ObjectId;
  order_item_id: Types.ObjectId;
  rating: number;
  comment: string;
  images: string[];
  moderationStatus: 'pending' | 'visible' | 'hidden';
  moderationReasons: string[];
  adminReply?: string | null;
  repliedAt?: Date | null;
  repliedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

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
    comment: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    images: [{ type: String, trim: true }],
    moderationStatus: {
      type: String,
      enum: ['pending', 'visible', 'hidden'],
      default: 'visible',
      index: true,
    },
    moderationReasons: [{ type: String, trim: true }],
    adminReply: { type: String, trim: true, maxlength: 2000, default: null },
    repliedAt: { type: Date, default: null },
    repliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Mỗi người dùng chỉ được tạo một đánh giá cho cùng một sản phẩm.
// Unique index cũng chặn được hai request tạo đánh giá chạy đồng thời.
reviewSchema.index({ user_id: 1, product_id: 1 }, { unique: true });
// Phục vụ truy vấn danh sách đánh giá của sản phẩm theo thời gian mới nhất.
reviewSchema.index({ product_id: 1, createdAt: -1 });
reviewSchema.index({ order_id: 1 });
reviewSchema.index({ moderationStatus: 1, createdAt: -1 });

export const Review = models.Review || model<IReview>('Review', reviewSchema);
