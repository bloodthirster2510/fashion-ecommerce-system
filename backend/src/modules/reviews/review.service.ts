import mongoose, { Types, type ClientSession } from 'mongoose';
import { Order, Product, Review, User, type IOrderItem } from '../../database/models';
import type {
  AdminReviewListQueryInput,
  CreateReviewInput,
  ReviewListQueryInput,
  ReviewModerationStatus,
  UpdateReviewInput,
} from './review.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Các kiểu *View mô tả kết quả sau khi Mongoose populate và lean.
// Chúng giúp phần serialize không phụ thuộc trực tiếp vào Mongoose Document.
type ReviewerView = {
  _id: Types.ObjectId;
  name: string;
  avatarImage?: string | null;
};

type ProductView = {
  _id: Types.ObjectId;
  name: string;
  product_image: string;
};

type ReviewOrderView = {
  _id: Types.ObjectId;
  order_list: IOrderItem[];
};

type ReviewView = {
  _id: Types.ObjectId;
  user_id: Types.ObjectId | ReviewerView;
  product_id: Types.ObjectId;
  order_id: Types.ObjectId | ReviewOrderView;
  order_item_id: Types.ObjectId;
  rating: number;
  comment: string;
  images?: string[];
  moderationStatus?: ReviewModerationStatus;
  moderationReasons?: string[];
  adminReply?: string | null;
  repliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MyReviewView = Omit<ReviewView, 'product_id'> & { product_id: ProductView };

export class ReviewServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'ReviewServiceError';
  }
}

const toObjectId = (value: unknown, fieldName: string) => {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw new ReviewServiceError(`Invalid ${fieldName}`, 400);
  }
  return new Types.ObjectId(value);
};

const normalizePagination = (query: ReviewListQueryInput) => ({
  page: Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE),
  limit: Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
});

export const REVIEW_MODERATION_RULES = {
  offensiveWords: ['đồ ngu', 'ngu ngốc', 'khốn nạn', 'lừa đảo', 'óc chó', 'vô học'],
  holdLinks: true,
  holdRepeatedSpam: true,
} as const;

const moderateReview = (comment: string) => {
  const normalized = comment.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  const reasons: string[] = [];

  if (REVIEW_MODERATION_RULES.offensiveWords.some((word) => normalized.includes(word))) {
    reasons.push('Có từ ngữ xúc phạm');
  }
  if (/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|vn)\b)/i.test(normalized)) {
    reasons.push('Có link quảng cáo');
  }
  if (/(\b[^\s,.!?]{2,}\b)(?:[\s,.!?]+\1){2,}/i.test(normalized) || /(.)\1{7,}/u.test(normalized)) {
    reasons.push('Spam lặp lại');
  }
  return {
    moderationStatus: (reasons.length > 0 ? 'pending' : 'visible') as ReviewModerationStatus,
    moderationReasons: reasons,
  };
};

const buildRatingDistribution = (
  ratingCounts: Array<{ _id: number; count: number }>,
  averageRating: number,
  reviewCount: number,
) => {
  const actualCount = ratingCounts.reduce((total, item) => total + item.count, 0);
  const countByRating = new Map(ratingCounts.map((item) => [item._id, item.count]));

  // Dữ liệu catalog cũ chỉ có điểm trung bình và tổng lượt, chưa có từng review.
  // Phân bổ số lượt vào hai mức sao gần nhất để progress vẫn biểu diễn được dữ liệu cũ.
  if (actualCount === 0 && reviewCount > 0 && averageRating >= 1 && averageRating <= 5) {
    const lowerRating = Math.floor(averageRating);
    const upperRating = Math.ceil(averageRating);

    if (lowerRating === upperRating) {
      countByRating.set(lowerRating, reviewCount);
    } else {
      const upperCount = Math.round((averageRating - lowerRating) * reviewCount);
      countByRating.set(upperRating, upperCount);
      countByRating.set(lowerRating, reviewCount - upperCount);
    }
  }

  const distributionTotal = actualCount || reviewCount;
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = countByRating.get(rating) ?? 0;
    return {
      rating,
      count,
      percent: distributionTotal > 0 ? Math.round((count / distributionTotal) * 100) : 0,
    };
  });
};

const isReviewerView = (value: Types.ObjectId | ReviewerView): value is ReviewerView =>
  'name' in value;

const isReviewOrderView = (value: Types.ObjectId | ReviewOrderView): value is ReviewOrderView =>
  'order_list' in value;

const serializeReview = (review: ReviewView) => {
  const user = isReviewerView(review.user_id) ? review.user_id : null;
  const order = isReviewOrderView(review.order_id) ? review.order_id : null;
  const purchasedItem = order?.order_list.find(
    (item) => item._id.toString() === review.order_item_id.toString(),
  );

  return {
    _id: review._id.toString(),
    productId: review.product_id.toString(),
    orderId: (order?._id ?? review.order_id).toString(),
    rating: review.rating,
    comment: review.comment,
    images: review.images ?? [],
    moderationStatus: review.moderationStatus ?? 'visible',
    moderationReasons: review.moderationReasons ?? [],
    adminReply: review.adminReply ?? null,
    repliedAt: review.repliedAt ?? null,
    // Mọi review đều được tạo qua createReview và luôn gắn với một đơn đủ điều kiện.
    verifiedPurchase: true,
    purchasedVariant: purchasedItem
      ? {
          variantId: purchasedItem.variantId.toString(),
          colorVariantId: purchasedItem.colorVariantId.toString(),
          fitType: purchasedItem.fitType,
          color: purchasedItem.color,
          size: purchasedItem.size,
          sku: purchasedItem.sku,
        }
      : null,
    user: user
      ? {
          _id: user._id.toString(),
          name: user.name,
          avatarImage: user.avatarImage ?? null,
        }
      : { _id: review.user_id.toString(), name: null, avatarImage: null },
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
};

const serializePublicReview = (review: ReviewView) => {
  const serialized = serializeReview(review);
  const isContentRemoved = serialized.moderationStatus === 'hidden';
  return {
    ...serialized,
    // Public API không trả nội dung gốc/lý do nội bộ của review đã bị ẩn.
    // Admin vẫn xem được dữ liệu đầy đủ qua listAdminReviews.
    comment: isContentRemoved ? 'Nội dung đánh giá này đã bị xóa do vi phạm tiêu chuẩn cộng đồng.' : serialized.comment,
    moderationReasons: [],
    isContentRemoved,
  };
};

const refreshProductRating = async (productId: Types.ObjectId, session?: ClientSession) => {
  // Tính lại từ toàn bộ review để số liệu luôn đúng sau cả tạo, sửa và xóa.
  // Điểm trung bình được làm tròn đến một chữ số thập phân trước khi lưu vào Product.
  const aggregate = Review.aggregate<{ averageRating: number; reviewCount: number }>([
    { $match: { product_id: productId, $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }] } },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  if (session) aggregate.session(session);
  const [summary] = await aggregate;

  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        averageRating: summary ? Math.round(summary.averageRating * 10) / 10 : 0,
        reviewCount: summary?.reviewCount ?? 0,
      },
    },
    session ? { session } : undefined,
  );
};

const withReviewTransaction = async <T>(operation: (session: ClientSession) => Promise<T>) => {
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    // Review và số liệu rating của Product phải đổi cùng nhau.
    // Nếu một bước lỗi, transaction giúp tránh product.averageRating bị lệch dữ liệu.
    await session.withTransaction(async () => {
      result = await operation(session);
    });
  } finally {
    await session.endSession();
  }
  if (result === undefined) throw new ReviewServiceError('Review transaction failed', 500);
  return result;
};

const findEligibleOrder = async (userId: Types.ObjectId, productId: Types.ObjectId) => {
  // Chỉ đơn đã giao và đã thanh toán mới được xem là đã mua thành công.
  // Lấy đơn gần nhất để lưu bằng chứng mua hàng vào review.
  return Order.findOne({
    user_id: userId,
    status: 'delivered',
    paymentStatus: 'paid',
    'order_list.productId': productId,
  })
    .sort({ deliveredAt: -1, createdAt: -1 })
    .select('_id order_list')
    .lean();
};

const getEligibility = async (userIdValue: string, productIdValue: string) => {
  const userId = toObjectId(userIdValue, 'userId');
  const productId = toObjectId(productIdValue, 'productId');
  // Ba truy vấn độc lập nên chạy song song để giảm thời gian phản hồi.
  const [product, existingReview, eligibleOrder] = await Promise.all([
    Product.findById(productId).select('_id').lean(),
    Review.findOne({ user_id: userId, product_id: productId })
      .select('_id moderationStatus moderationReasons')
      .lean<{ _id: Types.ObjectId; moderationStatus?: ReviewModerationStatus; moderationReasons?: string[] } | null>(),
    findEligibleOrder(userId, productId),
  ]);

  if (!product) {
    throw new ReviewServiceError('Product not found', 404);
  }

  return {
    productId: productId.toString(),
    canReview: Boolean(eligibleOrder) && !existingReview,
    hasPurchased: Boolean(eligibleOrder),
    hasReviewed: Boolean(existingReview),
    reviewId: existingReview?._id.toString() ?? null,
    reviewStatus: existingReview?.moderationStatus ?? null,
    moderationReasons: existingReview?.moderationReasons ?? [],
  };
};

const listProductReviews = async (productIdValue: string, query: ReviewListQueryInput = {}) => {
  const productId = toObjectId(productIdValue, 'productId');
  const { page, limit } = normalizePagination(query);
  const filter: Record<string, unknown> = {
    product_id: productId,
    $or: [
      { moderationStatus: 'visible' },
      { moderationStatus: 'hidden' },
      { moderationStatus: { $exists: false } },
    ],
  };
  if (query.rating !== undefined) filter.rating = query.rating;

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    rating_desc: { rating: -1, createdAt: -1 },
    rating_asc: { rating: 1, createdAt: -1 },
  } as const;
  const sort = sortMap[query.sort ?? 'newest'];

  const [reviews, totalItems, product, ratingCounts] = await Promise.all([
    Review.find(filter)
      .populate('user_id', '_id name avatarImage')
      .populate('order_id', '_id order_list')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Product.findById(productId).select('averageRating reviewCount').lean(),
    Review.aggregate<{ _id: number; count: number }>([
    { $match: { product_id: productId, $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }] } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  if (!product) throw new ReviewServiceError('Product not found', 404);

  return {
    items: reviews.map((review) => serializePublicReview(review as unknown as ReviewView)),
    summary: {
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      distribution: buildRatingDistribution(
        ratingCounts,
        product.averageRating,
        product.reviewCount,
      ),
    },
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
};

const listMyReviews = async (userIdValue: string, query: ReviewListQueryInput = {}) => {
  const userId = toObjectId(userIdValue, 'userId');
  const { page, limit } = normalizePagination(query);
  const filter: Record<string, unknown> = { user_id: userId };
  if (query.rating !== undefined) filter.rating = query.rating;
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    rating_desc: { rating: -1, createdAt: -1 },
    rating_asc: { rating: 1, createdAt: -1 },
  } as const;
  const [reviews, totalItems] = await Promise.all([
    Review.find(filter)
      .populate('user_id', '_id name avatarImage')
      .populate('product_id', '_id name product_image')
      .populate('order_id', '_id order_list')
      .sort(sortMap[query.sort ?? 'newest'])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return {
    items: reviews.map((rawReview) => {
      const review = rawReview as unknown as MyReviewView;
      return {
        // serializeReview cần product_id thuần; thông tin product đã populate được trả riêng.
        ...serializeReview({ ...review, product_id: review.product_id._id }),
        product: {
          _id: review.product_id._id.toString(),
          name: review.product_id.name,
          image: review.product_id.product_image,
        },
      };
    }),
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
};

const createReview = async (userIdValue: string, input: CreateReviewInput) => {
  const userId = toObjectId(userIdValue, 'userId');
  const productId = toObjectId(input.productId, 'productId');
  const product = await Product.findById(productId).select('_id').lean();
  if (!product) throw new ReviewServiceError('Product not found', 404);

  const existingReview = await Review.findOne({ user_id: userId, product_id: productId }).select('_id').lean();
  if (existingReview) throw new ReviewServiceError('You have already reviewed this product', 409);

  // Không nhận orderId từ client: server tự tìm đơn thuộc đúng người dùng để tránh giả mạo.
  const order = await findEligibleOrder(userId, productId);
  if (!order) {
    throw new ReviewServiceError('You can only review a product after it has been purchased and delivered', 403);
  }

  const orderItem = order.order_list.find(
    (item: IOrderItem) => item.productId.toString() === productId.toString(),
  );
  if (!orderItem) throw new ReviewServiceError('Purchased product was not found in the order', 409);

  try {
    const createdReviewId = await withReviewTransaction(async (session) => {
      const [review] = await Review.create([{
        user_id: userId,
        product_id: productId,
        order_id: order._id,
        order_item_id: orderItem._id,
        rating: input.rating,
        comment: input.comment.trim(),
        ...moderateReview(input.comment),
      }], { session });
      await refreshProductRating(productId, session);
      return review._id;
    });
    const populated = await Review.findById(createdReviewId)
      .populate('user_id', '_id name avatarImage')
      .populate('order_id', '_id order_list')
      .lean();
    return serializeReview(populated as unknown as ReviewView);
  } catch (error: unknown) {
    // Kiểm tra phía trên cho thông báo sớm; unique index vẫn là lớp bảo vệ cuối
    // khi hai request tạo đánh giá đến gần như cùng lúc.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw new ReviewServiceError('You have already reviewed this product', 409);
    }
    throw error;
  }
};

const updateReview = async (userIdValue: string, reviewIdValue: string, input: UpdateReviewInput) => {
  const userId = toObjectId(userIdValue, 'userId');
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  await withReviewTransaction(async (session) => {
    // Lọc kèm user_id để người dùng chỉ sửa được review của chính mình.
    const review = await Review.findOne({ _id: reviewId, user_id: userId }).session(session);
    if (!review) throw new ReviewServiceError('Review not found', 404);

    const wasHidden = review.moderationStatus === 'hidden';
    if (input.rating !== undefined) review.rating = input.rating;
    if (input.comment !== undefined) review.comment = input.comment.trim();
    if (input.comment !== undefined) {
      const moderation = moderateReview(review.comment);
      // Review đã bị admin ẩn phải quay lại hàng chờ sau khi người dùng sửa,
      // không được tự động hiện lại chỉ vì nội dung mới vượt qua bộ lọc đơn giản.
      review.moderationStatus = wasHidden && moderation.moderationStatus === 'visible'
        ? 'pending'
        : moderation.moderationStatus;
      review.moderationReasons = wasHidden && moderation.moderationReasons.length === 0
        ? ['Nội dung đã chỉnh sửa cần được kiểm duyệt lại']
        : moderation.moderationReasons;
    }
    await review.save({ session });
    await refreshProductRating(review.product_id, session);
    return review._id;
  });
  const populated = await Review.findById(reviewId)
    .populate('user_id', '_id name avatarImage')
    .populate('order_id', '_id order_list')
    .lean();
  return serializeReview(populated as unknown as ReviewView);
};

const deleteReview = async (userIdValue: string, reviewIdValue: string) => {
  const userId = toObjectId(userIdValue, 'userId');
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  // Lọc kèm user_id để không lộ việc review có tồn tại nhưng thuộc người khác.
  return withReviewTransaction(async (session) => {
    const review = await Review.findOneAndDelete({ _id: reviewId, user_id: userId }, { session });
    if (!review) throw new ReviewServiceError('Review not found', 404);
    await refreshProductRating(review.product_id, session);
    return { reviewId: review._id.toString(), deleted: true };
  });
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listAdminReviews = async (query: AdminReviewListQueryInput = {}) => {
  const { page, limit } = normalizePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.rating) filter.rating = query.rating;
  if (query.productId) filter.product_id = toObjectId(query.productId, 'productId');
  if (query.status === 'visible') {
    filter.$or = [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }];
  } else if (query.status) {
    filter.moderationStatus = query.status;
  }
  if (query.hasImages !== undefined) {
    filter['images.0'] = query.hasImages ? { $exists: true } : { $exists: false };
  }
  if (query.period) {
    const from = new Date();
    if (query.period === 'today') from.setHours(0, 0, 0, 0);
    if (query.period === 'week') from.setDate(from.getDate() - 7);
    if (query.period === 'month') from.setMonth(from.getMonth() - 1);
    filter.createdAt = { $gte: from };
  }

  const keyword = query.keyword?.trim();
  if (keyword) {
    const pattern = new RegExp(escapeRegExp(keyword), 'i');
    // Review lưu product/user bằng ObjectId nên phải tìm id liên quan trước,
    // sau đó gộp với tìm trực tiếp trong comment.
    const [products, users] = await Promise.all([
      Product.find({ name: pattern }).select('_id').lean(),
      User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id').lean(),
    ]);
    const keywordFilters: Record<string, unknown>[] = [
      { comment: pattern },
      { product_id: { $in: products.map((item) => item._id) } },
      { user_id: { $in: users.map((item) => item._id) } },
    ];
    if (Types.ObjectId.isValid(keyword)) keywordFilters.push({ order_id: new Types.ObjectId(keyword) });
    filter.$and = [{ $or: keywordFilters }];
  }

  const [reviews, totalItems, summaryRows, products] = await Promise.all([
    Review.find(filter)
      .populate('product_id', '_id name product_image')
      .populate('user_id', '_id name email avatarImage')
      .populate('order_id', '_id orderCode')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ _id: null; total: number; high: number; low: number; pending: number }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          high: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } },
          low: { $sum: { $cond: [{ $lt: ['$rating', 3] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$moderationStatus', 'pending'] }, 1, 0] } },
        },
      },
    ]),
    Product.find().select('_id name').sort({ name: 1 }).lean(),
  ]);

  const summary = summaryRows[0] ?? { total: 0, high: 0, low: 0, pending: 0 };
  return {
    items: reviews.map((review) => ({
      _id: review._id.toString(),
      product: review.product_id ? {
        _id: review.product_id._id.toString(), name: review.product_id.name, image: review.product_id.product_image,
      } : null,
      user: review.user_id ? {
        _id: review.user_id._id.toString(), name: review.user_id.name, email: review.user_id.email, avatarImage: review.user_id.avatarImage ?? null,
      } : null,
      order: review.order_id ? { _id: review.order_id._id.toString(), orderCode: review.order_id.orderCode } : null,
      rating: review.rating,
      comment: review.comment,
      images: review.images ?? [],
      status: review.moderationStatus ?? 'visible',
      moderationReasons: review.moderationReasons ?? [],
      adminReply: review.adminReply ?? null,
      repliedAt: review.repliedAt ?? null,
      createdAt: review.createdAt,
    })),
    summary,
    products: products.map((product) => ({ _id: product._id.toString(), name: product.name })),
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
};

const updateModerationStatus = async (reviewIdValue: string, status: ReviewModerationStatus) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  return withReviewTransaction(async (session) => {
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $set: { moderationStatus: status } },
      { new: true, session },
    );
    if (!review) throw new ReviewServiceError('Review not found', 404);
    await refreshProductRating(review.product_id, session);
    return { reviewId: review._id.toString(), status: review.moderationStatus };
  });
};

const updateManyModerationStatuses = async (reviewIdValues: string[], status: ReviewModerationStatus) => {
  // Dedupe trước khi update để count và refresh rating không bị nhân đôi khi UI gửi trùng id.
  const reviewIds = [...new Set(reviewIdValues)].map((value) => toObjectId(value, 'reviewId'));
  if (reviewIds.length === 0 || reviewIds.length > 100) {
    throw new ReviewServiceError('Select between 1 and 100 reviews', 400);
  }
  return withReviewTransaction(async (session) => {
    const reviews = await Review.find({ _id: { $in: reviewIds } })
      .select('_id product_id')
      .session(session)
      .lean();
    await Review.updateMany(
      { _id: { $in: reviewIds } },
      { $set: { moderationStatus: status } },
      { session },
    );
    const productIds = [...new Set(reviews.map((review) => review.product_id.toString()))];
    for (const productId of productIds) {
      await refreshProductRating(new Types.ObjectId(productId), session);
    }
    return { updatedCount: reviews.length, status };
  });
};

const replyToReview = async (reviewIdValue: string, adminIdValue: string, reply: string) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const adminId = toObjectId(adminIdValue, 'adminId');
  const review = await Review.findByIdAndUpdate(
    reviewId,
    { $set: { adminReply: reply.trim(), repliedAt: new Date(), repliedBy: adminId } },
    { new: true },
  );
  if (!review) throw new ReviewServiceError('Review not found', 404);
  return { reviewId: review._id.toString(), adminReply: review.adminReply, repliedAt: review.repliedAt };
};

export const reviewService = {
  getEligibility,
  listProductReviews,
  listMyReviews,
  createReview,
  updateReview,
  deleteReview,
  listAdminReviews,
  updateModerationStatus,
  updateManyModerationStatuses,
  replyToReview,
};
