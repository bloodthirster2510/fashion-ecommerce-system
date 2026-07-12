import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  Category,
  Order,
  Product,
  Review,
  ReviewHelpfulVote,
  User,
  type ICategoryFitType,
  type IOrderItem,
  type IProductVariant,
  type IReviewImage,
} from '../../database/models';
import { auditLogService } from '../audit-logs/audit-log.service';
import { cleanupReviewImages, uploadReviewImages } from './review-images';
import type {
  AdminReviewListQueryInput,
  CreateReviewInput,
  EligibleReviewItemsQueryInput,
  ReviewAdminActor,
  ReviewCriteriaInput,
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
  orderCode?: string;
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
  criteria?: ReviewCriteriaInput | null;
  images?: Array<IReviewImage | string>;
  moderationStatus?: ReviewModerationStatus;
  moderationReasons?: string[];
  helpfulCount?: number;
  adminReply?: string | null;
  repliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MyReviewView = Omit<ReviewView, 'product_id'> & { product_id: ProductView };

type EligibleOrderView = {
  _id: Types.ObjectId;
  orderCode: string;
  deliveredAt?: Date | null;
  order_list: IOrderItem[];
};

type EligibleReviewView = {
  _id: Types.ObjectId;
  order_id: Types.ObjectId;
  order_item_id: Types.ObjectId;
  rating: number;
  comment: string;
  moderationStatus?: ReviewModerationStatus;
  moderationReasons?: string[];
  helpfulCount?: number;
  createdAt: Date;
};

type IdLike = Types.ObjectId | string | { toString(): string } | null | undefined;

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

const buildRatingDistribution = (ratingCounts: Array<{ _id: number; count: number }>) => {
  const totalCount = ratingCounts.reduce((total, item) => total + item.count, 0);
  const countByRating = new Map(ratingCounts.map((item) => [item._id, item.count]));

  return [5, 4, 3, 2, 1].map((rating) => {
    const count = countByRating.get(rating) ?? 0;
    return {
      rating,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });
};

const isReviewerView = (value: Types.ObjectId | ReviewerView): value is ReviewerView =>
  'name' in value;

const isReviewOrderView = (value: Types.ObjectId | ReviewOrderView): value is ReviewOrderView =>
  'order_list' in value;

const serializeImages = (images: Array<IReviewImage | string> = []) => images.map((image) => {
  if (typeof image === 'string') {
    return { _id: null, url: image, thumbnailUrl: image, width: null, height: null };
  }
  return {
    _id: image._id?.toString() ?? null,
    url: image.url,
    thumbnailUrl: image.thumbnailUrl || image.url,
    width: image.width ?? null,
    height: image.height ?? null,
  };
});

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
    orderItemId: review.order_item_id.toString(),
    rating: review.rating,
    comment: review.comment,
    criteria: review.criteria ?? null,
    images: serializeImages(review.images),
    moderationStatus: review.moderationStatus ?? 'visible',
    moderationReasons: review.moderationReasons ?? [],
    helpfulCount: review.helpfulCount ?? 0,
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
  return {
    _id: serialized._id,
    productId: serialized.productId,
    rating: serialized.rating,
    comment: serialized.comment,
    criteria: serialized.criteria,
    images: serialized.images,
    helpfulCount: serialized.helpfulCount,
    hasVotedHelpful: false,
    verifiedPurchase: serialized.verifiedPurchase,
    purchasedVariant: serialized.purchasedVariant,
    user: serialized.user,
    adminReply: serialized.adminReply
      ? { content: serialized.adminReply, repliedAt: serialized.repliedAt }
      : null,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
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

const getEligibility = async (
  userIdValue: string,
  orderIdValue: string,
  orderItemIdValue: string,
) => {
  const userId = toObjectId(userIdValue, 'userId');
  const orderId = toObjectId(orderIdValue, 'orderId');
  const orderItemId = toObjectId(orderItemIdValue, 'orderItemId');
  const order = await Order.findOne({ _id: orderId, user_id: userId })
    .select('_id status paymentStatus order_list')
    .lean();

  if (!order) {
    return {
      canReview: false,
      reason: 'ORDER_NOT_FOUND' as const,
      orderStatus: null,
      paymentStatus: null,
      reviewId: null,
      reviewStatus: null,
    };
  }

  if (order.status !== 'completed') {
    return {
      canReview: false,
      reason: 'NOT_DELIVERED' as const,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      reviewId: null,
      reviewStatus: null,
    };
  }

  if (order.paymentStatus !== 'paid') {
    return {
      canReview: false,
      reason: 'NOT_PAID' as const,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      reviewId: null,
      reviewStatus: null,
    };
  }

  const orderItem = order.order_list.find((item: IOrderItem) => item._id.equals(orderItemId));
  if (!orderItem) {
    return {
      canReview: false,
      reason: 'ITEM_NOT_FOUND' as const,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      reviewId: null,
      reviewStatus: null,
    };
  }

  const [product, existingReview] = await Promise.all([
    Product.findOne({ _id: orderItem.productId, isActive: true }).select('_id').lean(),
    Review.findOne({ order_id: orderId, order_item_id: orderItemId })
      .select('_id moderationStatus moderationReasons')
      .lean<{ _id: Types.ObjectId; moderationStatus?: ReviewModerationStatus; moderationReasons?: string[] } | null>(),
  ]);

  if (!product) {
    return {
      canReview: false,
      reason: 'PRODUCT_UNAVAILABLE' as const,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      reviewId: null,
      reviewStatus: null,
    };
  }

  return {
    canReview: !existingReview,
    reason: existingReview ? 'ALREADY_REVIEWED' as const : null,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    reviewId: existingReview?._id.toString() ?? null,
    reviewStatus: existingReview?.moderationStatus ?? null,
  };
};

const listEligibleItems = async (
  userIdValue: string,
  query: EligibleReviewItemsQueryInput = {},
) => {
  const userId = toObjectId(userIdValue, 'userId');
  const { page, limit } = normalizePagination(query);
  const productId = query.productId ? toObjectId(query.productId, 'productId') : null;
  const orderFilter: Record<string, unknown> = {
    user_id: userId,
    status: 'completed',
    paymentStatus: 'paid',
  };
  if (productId) orderFilter['order_list.productId'] = productId;

  const orders = await Order.find(orderFilter)
    .select('_id orderCode deliveredAt order_list')
    .sort({ deliveredAt: -1, createdAt: -1 })
    .lean() as unknown as EligibleOrderView[];
  if (orders.length === 0) {
    return {
      items: [],
      pagination: { page, limit, totalItems: 0, totalPages: 0 },
    };
  }

  const orderIds = orders.map((order) => order._id);
  const productIds = [...new Set(orders.flatMap((order) => order.order_list.map(
    (item) => item.productId.toString(),
  )))].map((id) => new Types.ObjectId(id));
  const [reviews, activeProducts] = await Promise.all([
    Review.find({ user_id: userId, order_id: { $in: orderIds } })
      .select('_id order_id order_item_id rating comment moderationStatus moderationReasons createdAt')
      .lean() as unknown as Promise<EligibleReviewView[]>,
    Product.find({ _id: { $in: productIds }, isActive: true }).select('_id').lean(),
  ]);
  const activeProductIds = new Set(activeProducts.map((product) => product._id.toString()));
  const reviewByOrderItem = new Map(reviews.map((review) => [
    `${review.order_id.toString()}:${review.order_item_id.toString()}`,
    review,
  ]));

  const allItems = orders.flatMap((order) => order.order_list
    .filter((item) => !productId || item.productId.equals(productId))
    .map((item) => {
      const review = reviewByOrderItem.get(`${order._id.toString()}:${item._id.toString()}`) ?? null;
      const productAvailable = activeProductIds.has(item.productId.toString());
      return {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        deliveredAt: order.deliveredAt ?? null,
        orderItemId: item._id.toString(),
        product: {
          _id: item.productId.toString(),
          name: item.name,
          image: item.image,
        },
        variant: {
          variantId: item.variantId.toString(),
          colorVariantId: item.colorVariantId.toString(),
          fitType: item.fitType,
          color: item.color,
          size: item.size,
          sku: item.sku,
        },
        canReview: productAvailable && !review,
        reason: !productAvailable ? 'PRODUCT_UNAVAILABLE' as const
          : review ? 'ALREADY_REVIEWED' as const
            : null,
        review: review ? {
          _id: review._id.toString(),
          rating: review.rating,
          comment: review.comment,
          status: review.moderationStatus ?? 'visible',
          moderationReasons: review.moderationReasons ?? [],
          createdAt: review.createdAt,
        } : null,
      };
    }));
  const filteredItems = allItems.filter((item) => {
    if (query.status === 'eligible') return item.canReview;
    if (query.status === 'reviewed') return Boolean(item.review);
    return true;
  });
  const totalItems = filteredItems.length;
  const start = (page - 1) * limit;

  return {
    items: filteredItems.slice(start, start + limit),
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
};

const listProductReviews = async (productIdValue: string, query: ReviewListQueryInput = {}) => {
  const productId = toObjectId(productIdValue, 'productId');
  const { page, limit } = normalizePagination(query);
  const filter: Record<string, unknown> = {
    product_id: productId,
    $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }],
  };
  if (query.rating !== undefined) filter.rating = query.rating;

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    rating_desc: { rating: -1, createdAt: -1 },
    rating_asc: { rating: 1, createdAt: -1 },
    helpful: { helpfulCount: -1, createdAt: -1 },
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
    Product.findById(productId).select('_id').lean(),
    Review.aggregate<{ _id: number; count: number }>([
      { $match: { product_id: productId, $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }] } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  if (!product) throw new ReviewServiceError('Product not found', 404);
  const publicReviewCount = ratingCounts.reduce((total, item) => total + item.count, 0);
  const publicAverageRating = publicReviewCount > 0
    ? Math.round((ratingCounts.reduce((total, item) => total + item._id * item.count, 0) / publicReviewCount) * 10) / 10
    : 0;

  return {
    items: reviews.map((review) => serializePublicReview(review as unknown as ReviewView)),
    summary: {
      averageRating: publicAverageRating,
      reviewCount: publicReviewCount,
      distribution: buildRatingDistribution(ratingCounts),
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
    helpful: { helpfulCount: -1, createdAt: -1 },
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

const createReview = async (
  userIdValue: string,
  input: CreateReviewInput,
  files: Express.Multer.File[] = [],
) => {
  const userId = toObjectId(userIdValue, 'userId');
  const orderId = toObjectId(input.orderId, 'orderId');
  const orderItemId = toObjectId(input.orderItemId, 'orderItemId');
  const order = await Order.findOne({ _id: orderId, user_id: userId })
    .select('_id status paymentStatus order_list')
    .lean();
  if (!order) throw new ReviewServiceError('Order not found', 404);
  if (order.status !== 'completed') {
    throw new ReviewServiceError('You can only review an order after it has been delivered', 403);
  }
  if (order.paymentStatus !== 'paid') {
    throw new ReviewServiceError('You can only review a paid order', 403);
  }

  const orderItem = order.order_list.find((item: IOrderItem) => item._id.equals(orderItemId));
  if (!orderItem) throw new ReviewServiceError('Order item not found', 404);
  const productId = orderItem.productId;
  const [product, existingReview] = await Promise.all([
    Product.findOne({ _id: productId, isActive: true }).select('_id').lean(),
    Review.findOne({ order_id: orderId, order_item_id: orderItemId }).select('_id').lean(),
  ]);
  if (!product) throw new ReviewServiceError('Product is unavailable', 409);
  if (existingReview) throw new ReviewServiceError('This order item has already been reviewed', 409);

  const moderation = moderateReview(input.comment);
  const moderationHistory = moderation.moderationStatus === 'pending'
    ? [{
        action: 'auto_pending' as const,
        fromStatus: 'visible' as const,
        toStatus: 'pending' as const,
        reason: moderation.moderationReasons.join(', '),
        actorId: null,
        actorRole: 'system' as const,
        createdAt: new Date(),
      }]
    : [];

  const createdReviewId = new Types.ObjectId();
  let uploadedImages: Awaited<ReturnType<typeof uploadReviewImages>> = [];
  let committed = false;
  try {
    uploadedImages = await uploadReviewImages(createdReviewId.toString(), files);
    await withReviewTransaction(async (session) => {
      const [review] = await Review.create([{
        _id: createdReviewId,
        user_id: userId,
        product_id: productId,
        order_id: order._id,
        order_item_id: orderItem._id,
        rating: input.rating,
        comment: input.comment.trim(),
        criteria: input.criteria ?? null,
        images: uploadedImages,
        ...moderation,
        moderationHistory,
      }], { session });
      await refreshProductRating(productId, session);
      return review._id;
    });
    committed = true;
    const populated = await Review.findById(createdReviewId)
      .populate('user_id', '_id name avatarImage')
      .populate('order_id', '_id order_list')
      .lean();
    return serializeReview(populated as unknown as ReviewView);
  } catch (error: unknown) {
    if (!committed && uploadedImages.length) await cleanupReviewImages(uploadedImages);
    // Kiểm tra phía trên cho thông báo sớm; unique index vẫn là lớp bảo vệ cuối
    // khi hai request tạo đánh giá đến gần như cùng lúc.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw new ReviewServiceError('This order item has already been reviewed', 409);
    }
    throw error;
  }
};

const updateReview = async (
  userIdValue: string,
  reviewIdValue: string,
  input: UpdateReviewInput,
  files: Express.Multer.File[] = [],
) => {
  const userId = toObjectId(userIdValue, 'userId');
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const existingReview = await Review.findOne({ _id: reviewId, user_id: userId })
    .select('_id images')
    .lean();
  if (!existingReview) throw new ReviewServiceError('Review not found', 404);

  const currentImages = (existingReview.images ?? []) as Array<IReviewImage | string>;
  const requestedImageIds = input.keepImageIds === undefined
    ? null
    : new Set(input.keepImageIds);
  const keptImages = requestedImageIds === null
    ? currentImages
    : currentImages.filter((image) => (
        typeof image !== 'string' && requestedImageIds.has(image._id.toString())
      ));
  if (requestedImageIds && keptImages.length !== requestedImageIds.size) {
    throw new ReviewServiceError('keepImageIds contains an image that does not belong to this review', 400);
  }
  if (keptImages.length + files.length > 5) {
    throw new ReviewServiceError('A review can contain at most 5 images', 400);
  }
  const removedImages = currentImages.filter((image) => !keptImages.includes(image));
  let uploadedImages: Awaited<ReturnType<typeof uploadReviewImages>> = [];

  try {
    uploadedImages = await uploadReviewImages(reviewId.toString(), files);
    await withReviewTransaction(async (session) => {
    // Lọc kèm user_id để người dùng chỉ sửa được review của chính mình.
    const review = await Review.findOne({ _id: reviewId, user_id: userId }).session(session);
    if (!review) throw new ReviewServiceError('Review not found', 404);

    const wasHidden = review.moderationStatus === 'hidden';
    const previousStatus = review.moderationStatus;
    const previousComment = review.comment;
    if (input.rating !== undefined) review.rating = input.rating;
    if (input.criteria !== undefined) review.criteria = input.criteria;
    if (input.keepImageIds !== undefined || uploadedImages.length > 0) {
      review.images = [...keptImages, ...uploadedImages] as IReviewImage[];
    }
    if (input.comment !== undefined) review.comment = input.comment.trim();
    // Chỉ chạy lại moderation khi comment thực sự thay đổi, tránh đẩy review visible về pending
    // chỉ vì user mở modal rồi lưu lại mà không sửa nội dung.
    if (input.comment !== undefined && review.comment !== previousComment) {
      const moderation = moderateReview(review.comment);
      // Review đã bị admin ẩn phải quay lại hàng chờ sau khi người dùng sửa,
      // không được tự động hiện lại chỉ vì nội dung mới vượt qua bộ lọc đơn giản.
      review.moderationStatus = wasHidden && moderation.moderationStatus === 'visible'
        ? 'pending'
        : moderation.moderationStatus;
      review.moderationReasons = wasHidden && moderation.moderationReasons.length === 0
        ? ['Nội dung đã chỉnh sửa cần được kiểm duyệt lại']
        : moderation.moderationReasons;
      if (review.moderationStatus === 'pending' && previousStatus !== 'pending') {
        review.moderationHistory ??= [];
        review.moderationHistory.push({
          action: 'auto_pending',
          fromStatus: previousStatus,
          toStatus: 'pending',
          reason: review.moderationReasons.join(', '),
          actorId: null,
          actorRole: 'system',
          createdAt: new Date(),
        });
      }
    }
    await review.save({ session });
    await refreshProductRating(review.product_id, session);
    return review._id;
    });
  } catch (error) {
    if (uploadedImages.length) await cleanupReviewImages(uploadedImages);
    throw error;
  }
  if (removedImages.length) {
    await cleanupReviewImages(removedImages.filter(
      (image): image is IReviewImage => typeof image !== 'string',
    ));
  }
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
  const result = await withReviewTransaction(async (session) => {
    const review = await Review.findOneAndDelete({ _id: reviewId, user_id: userId }, { session });
    if (!review) throw new ReviewServiceError('Review not found', 404);
    await ReviewHelpfulVote.deleteMany({ review_id: reviewId }, { session });
    await refreshProductRating(review.product_id, session);
    return {
      reviewId: review._id.toString(),
      deleted: true,
      images: ((review.images ?? []) as Array<IReviewImage | string>).filter(
        (image): image is IReviewImage => typeof image !== 'string',
      ),
    };
  });
  if (result.images.length) await cleanupReviewImages(result.images);
  return { reviewId: result.reviewId, deleted: result.deleted };
};

const deletePendingReviewAsAdmin = async (reviewIdValue: string) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const result = await withReviewTransaction(async (session) => {
    const review = await Review.findById(reviewId).session(session);
    if (!review) throw new ReviewServiceError('Review not found', 404);
    if ((review.moderationStatus ?? 'visible') !== 'pending') {
      throw new ReviewServiceError('Only pending reviews can be deleted by moderation', 409);
    }

    await Review.deleteOne({ _id: reviewId }, { session });
    await ReviewHelpfulVote.deleteMany({ review_id: reviewId }, { session });
    await refreshProductRating(review.product_id, session);
    return {
      reviewId: review._id.toString(),
      images: ((review.images ?? []) as Array<IReviewImage | string>).filter(
        (image): image is IReviewImage => typeof image !== 'string',
      ),
    };
  });

  if (result.images.length) await cleanupReviewImages(result.images);
  return { reviewId: result.reviewId, deleted: true };
};

const toggleHelpfulVote = async (userIdValue: string, reviewIdValue: string) => {
  const userId = toObjectId(userIdValue, 'userId');
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const review = await Review.findById(reviewId)
    .select('_id user_id moderationStatus helpfulCount')
    .lean();
  if (!review || (review.moderationStatus && review.moderationStatus !== 'visible')) {
    throw new ReviewServiceError('Review not found', 404);
  }
  if (review.user_id.toString() === userId.toString()) {
    throw new ReviewServiceError('You cannot mark your own review as helpful', 409);
  }

  return withReviewTransaction(async (session) => {
    const removedVote = await ReviewHelpfulVote.findOneAndDelete(
      { review_id: reviewId, user_id: userId },
      { session },
    );
    let hasVotedHelpful = false;
    if (!removedVote) {
      try {
        await ReviewHelpfulVote.create([{ review_id: reviewId, user_id: userId }], { session });
        hasVotedHelpful = true;
      } catch (error: unknown) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) {
          throw error;
        }
        hasVotedHelpful = true;
      }
    }
    const helpfulCount = await ReviewHelpfulVote.countDocuments({ review_id: reviewId }).session(session);
    await Review.updateOne({ _id: reviewId }, { $set: { helpfulCount } }, { session });
    return { reviewId: reviewId.toString(), helpfulCount, hasVotedHelpful };
  });
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toIdString = (value: IdLike) => value?.toString() ?? '';

const isObjectIdText = (value?: string) => Boolean(
  value && /^[a-f\d]{24}$/i.test(value) && Types.ObjectId.isValid(value),
);

const resolveReviewOrderFitTypeLabels = async (orders: ReviewOrderView[]) => {
  const items = orders.flatMap((order) => order.order_list ?? [])
    .filter((item) => isObjectIdText(item.fitType));

  if (!items.length) return;

  const fitTypeIds = Array.from(new Set(items.map((item) => item.fitType)))
    .filter((id): id is string => Boolean(id) && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const directCategories = fitTypeIds.length
    ? await Category.find({ 'fitTypes._id': { $in: fitTypeIds } }).select('fitTypes').lean()
    : [];
  const labelByFitTypeId = new Map<string, string>();

  directCategories.forEach((category) => {
    category.fitTypes?.forEach((fitType: ICategoryFitType) => {
      labelByFitTypeId.set(toIdString(fitType._id), fitType.label);
    });
  });

  const productIds = Array.from(new Set(items.map((item) => toIdString(item.productId))))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
      .select('category_id variant._id variant.fitTypeId')
      .lean()
    : [];
  const categoryIds = Array.from(new Set([
    ...products.map((product) => toIdString(product.category_id)),
    ...items.map((item) => item.fitType),
  ]))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const categories = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds } }).select('fitTypes').lean()
    : [];
  const fitTypeLabelByCategory = new Map<string, string>();

  categories.forEach((category) => {
    category.fitTypes?.forEach((fitType: ICategoryFitType) => {
      fitTypeLabelByCategory.set(`${toIdString(category._id)}:${toIdString(fitType._id)}`, fitType.label);
      labelByFitTypeId.set(toIdString(fitType._id), fitType.label);
    });
  });

  const fitTypeLabelByProductVariant = new Map<string, string>();
  products.forEach((product) => {
    product.variant.forEach((variant: IProductVariant) => {
      const fitTypeId = toIdString(variant.fitTypeId);
      const label = fitTypeLabelByCategory.get(`${toIdString(product.category_id)}:${fitTypeId}`);

      if (label) {
        fitTypeLabelByProductVariant.set(`${toIdString(product._id)}:${toIdString(variant._id)}`, label);
      }
    });
  });

  orders.forEach((order) => {
    order.order_list?.forEach((item) => {
      if (!isObjectIdText(item.fitType)) return;

      const label = labelByFitTypeId.get(item.fitType)
        ?? fitTypeLabelByProductVariant.get(`${toIdString(item.productId)}:${toIdString(item.variantId)}`);
      if (label) {
        item.fitType = label;
      }
    });
  });
};

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
      .populate('order_id', '_id orderCode order_list')
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

  await resolveReviewOrderFitTypeLabels(
    reviews
      .map((review) => review.order_id as unknown as ReviewOrderView | null)
      .filter((order): order is ReviewOrderView => Boolean(order?.order_list)),
  );

  const summary = summaryRows[0] ?? { total: 0, high: 0, low: 0, pending: 0 };
  return {
    items: reviews.map((review) => {
      const order = review.order_id as unknown as ReviewOrderView | null;
      const orderItem = order?.order_list?.find((item) => item._id.toString() === review.order_item_id.toString());
      return {
        _id: review._id.toString(),
        product: review.product_id ? {
          _id: review.product_id._id.toString(), name: review.product_id.name, image: review.product_id.product_image,
        } : null,
        user: review.user_id ? {
          _id: review.user_id._id.toString(), name: review.user_id.name, email: review.user_id.email, avatarImage: review.user_id.avatarImage ?? null,
        } : null,
        order: order ? { _id: order._id.toString(), orderCode: order.orderCode, item: orderItem ?? null } : null,
        rating: review.rating,
        comment: review.comment,
        images: serializeImages(review.images as Array<IReviewImage | string> | undefined),
        status: review.moderationStatus ?? 'visible',
        moderationReasons: review.moderationReasons ?? [],
        adminReply: review.adminReply ?? null,
        repliedAt: review.repliedAt ?? null,
        createdAt: review.createdAt,
      };
    }),
    summary,
    products: products.map((product) => ({ _id: product._id.toString(), name: product.name })),
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
};

const getModerationAction = (
  fromStatus: ReviewModerationStatus,
  toStatus: ReviewModerationStatus,
) => {
  if (toStatus === 'hidden') return 'hidden' as const;
  if (fromStatus === 'hidden') return 'restored' as const;
  return 'approved' as const;
};

const getAdminReviewDetail = async (reviewIdValue: string) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const review = await Review.findById(reviewId)
    .populate('product_id', '_id name product_image')
    .populate('user_id', '_id name email avatarImage')
    .populate('order_id', '_id orderCode order_list')
    .populate('repliedBy', '_id name email role')
    .lean();
  if (!review) throw new ReviewServiceError('Review not found', 404);
  const order = review.order_id as unknown as ReviewOrderView & { orderCode?: string };
  if (order?.order_list) {
    await resolveReviewOrderFitTypeLabels([order]);
  }
  const orderItem = order.order_list?.find((item) => item._id.toString() === review.order_item_id.toString());
  return {
    _id: review._id.toString(),
    product: review.product_id ? {
      _id: review.product_id._id.toString(), name: review.product_id.name, image: review.product_id.product_image,
    } : null,
    user: review.user_id ? {
      _id: review.user_id._id.toString(), name: review.user_id.name, email: review.user_id.email, avatarImage: review.user_id.avatarImage ?? null,
    } : null,
    order: order ? { _id: order._id.toString(), orderCode: order.orderCode, item: orderItem ?? null } : null,
    rating: review.rating,
    comment: review.comment,
    criteria: review.criteria ?? null,
    images: serializeImages(review.images as Array<IReviewImage | string> | undefined),
    status: review.moderationStatus ?? 'visible',
    moderationReasons: review.moderationReasons ?? [],
    moderationHistory: review.moderationHistory ?? [],
    adminReply: review.adminReply ?? null,
    repliedAt: review.repliedAt ?? null,
    repliedBy: review.repliedBy ?? null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
};

const updateModerationStatus = async (
  reviewIdValue: string,
  status: ReviewModerationStatus,
  actor: ReviewAdminActor,
  reason?: string,
) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const normalizedReason = reason?.trim() || null;
  if (status === 'hidden' && (!normalizedReason || normalizedReason.length < 5)) {
    throw new ReviewServiceError('Reason must contain between 5 and 500 characters when hiding a review', 400);
  }
  if (normalizedReason && normalizedReason.length > 500) {
    throw new ReviewServiceError('Reason must contain between 5 and 500 characters', 400);
  }

  const result = await withReviewTransaction(async (session) => {
    const review = await Review.findById(reviewId).session(session);
    if (!review) throw new ReviewServiceError('Review not found', 404);
    const previousStatus = review.moderationStatus ?? 'visible';
    review.moderationStatus = status;
    review.moderationReasons = status === 'hidden' && normalizedReason ? [normalizedReason] : [];
    review.moderationHistory ??= [];
    review.moderationHistory.push({
      action: getModerationAction(previousStatus, status),
      fromStatus: previousStatus,
      toStatus: status,
      reason: normalizedReason,
      actorId: new Types.ObjectId(actor.userId),
      actorRole: actor.role,
      createdAt: new Date(),
    });
    await review.save({ session });
    await refreshProductRating(review.product_id, session);
    return { reviewId: review._id.toString(), status: review.moderationStatus, previousStatus };
  });

  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'review.moderation',
    targetType: 'Review',
    targetId: result.reviewId,
    reason: normalizedReason,
    before: { moderationStatus: result.previousStatus },
    after: { moderationStatus: result.status },
  });

  return { reviewId: result.reviewId, status: result.status };
};

const updateManyModerationStatuses = async (
  reviewIdValues: string[],
  status: ReviewModerationStatus,
  actor: ReviewAdminActor,
  reason?: string,
) => {
  // Dedupe trước khi update để count và refresh rating không bị nhân đôi khi UI gửi trùng id.
  const reviewIds = [...new Set(reviewIdValues)].map((value) => toObjectId(value, 'reviewId'));
  if (reviewIds.length === 0 || reviewIds.length > 100) {
    throw new ReviewServiceError('Select between 1 and 100 reviews', 400);
  }
  const normalizedReason = reason?.trim() || null;
  if (status === 'hidden' && (!normalizedReason || normalizedReason.length < 5)) {
    throw new ReviewServiceError('Reason must contain between 5 and 500 characters when hiding reviews', 400);
  }
  if (normalizedReason && normalizedReason.length > 500) {
    throw new ReviewServiceError('Reason must contain between 5 and 500 characters', 400);
  }

  const result = await withReviewTransaction(async (session) => {
    const reviews = await Review.find({ _id: { $in: reviewIds } })
      .select('_id product_id moderationStatus')
      .session(session)
      .lean();
    const createdAt = new Date();
    if (reviews.length > 0) {
      await Promise.all(reviews.map((review) => {
        const previousStatus = review.moderationStatus ?? 'visible';
        return Review.updateOne(
          { _id: review._id },
          {
            $set: {
              moderationStatus: status,
              moderationReasons: status === 'hidden' && normalizedReason ? [normalizedReason] : [],
            },
            $push: {
              moderationHistory: {
                action: getModerationAction(previousStatus, status),
                fromStatus: previousStatus,
                toStatus: status,
                reason: normalizedReason,
                actorId: new Types.ObjectId(actor.userId),
                actorRole: actor.role,
                createdAt,
              },
            },
          },
          { session },
        );
      }));
    }
    const productIds = [...new Set(reviews.map((review) => review.product_id.toString()))];
    for (const productId of productIds) {
      await refreshProductRating(new Types.ObjectId(productId), session);
    }
    return {
      updatedCount: reviews.length,
      skippedCount: reviewIds.length - reviews.length,
      status,
      reviews: reviews.map((review) => ({
        reviewId: review._id.toString(),
        previousStatus: (review.moderationStatus ?? 'visible') as ReviewModerationStatus,
      })),
    };
  });

  await Promise.all(result.reviews.map((review) => auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'review.moderation',
    targetType: 'Review',
    targetId: review.reviewId,
    reason: normalizedReason,
    before: { moderationStatus: review.previousStatus },
    after: { moderationStatus: status },
    metadata: { bulk: true },
  })));

  return {
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    status: result.status,
  };
};

const replyToReview = async (reviewIdValue: string, actor: ReviewAdminActor, reply: string) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const adminId = toObjectId(actor.userId, 'adminId');
  const result = await withReviewTransaction(async (session) => {
    const review = await Review.findById(reviewId).session(session);
    if (!review) throw new ReviewServiceError('Review not found', 404);
    if (review.moderationStatus === 'hidden') {
      throw new ReviewServiceError('A hidden review must be restored before replying', 409);
    }
    const previousReply = review.adminReply ?? null;
    review.adminReply = reply.trim();
    review.repliedAt = new Date();
    review.repliedBy = adminId;
    await review.save({ session });
    return {
      reviewId: review._id.toString(),
      previousReply,
      adminReply: review.adminReply,
      repliedAt: review.repliedAt,
    };
  });
  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'review.reply',
    targetType: 'Review',
    targetId: result.reviewId,
    before: { adminReply: result.previousReply },
    after: { adminReply: result.adminReply, repliedAt: result.repliedAt },
  });
  return { reviewId: result.reviewId, adminReply: result.adminReply, repliedAt: result.repliedAt };
};

const deleteReviewReply = async (reviewIdValue: string, actor: ReviewAdminActor) => {
  const reviewId = toObjectId(reviewIdValue, 'reviewId');
  const result = await withReviewTransaction(async (session) => {
    const review = await Review.findById(reviewId).session(session);
    if (!review) throw new ReviewServiceError('Review not found', 404);
    const previousReply = review.adminReply ?? null;
    const previousRepliedAt = review.repliedAt ?? null;
    review.adminReply = null;
    review.repliedAt = null;
    review.repliedBy = null;
    await review.save({ session });
    return { reviewId: review._id.toString(), previousReply, previousRepliedAt };
  });
  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'review.reply_delete',
    targetType: 'Review',
    targetId: result.reviewId,
    before: { adminReply: result.previousReply, repliedAt: result.previousRepliedAt },
    after: { adminReply: null, repliedAt: null },
  });

  return { reviewId: result.reviewId, deleted: true };
};

export const reviewService = {
  getEligibility,
  listEligibleItems,
  listProductReviews,
  listMyReviews,
  createReview,
  updateReview,
  deleteReview,
  deletePendingReviewAsAdmin,
  toggleHelpfulVote,
  listAdminReviews,
  getAdminReviewDetail,
  updateModerationStatus,
  updateManyModerationStatuses,
  replyToReview,
  deleteReviewReply,
};
