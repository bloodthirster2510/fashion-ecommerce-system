import { Types } from 'mongoose';
import { Order, Product, Review, User, type IOrderItem } from '../models';

type ReviewSeedTemplate = {
  rating: number;
  comment: string;
  moderationStatus: 'pending' | 'visible' | 'hidden';
  moderationReasons: string[];
  reply?: string;
  includeImage?: boolean;
};

const templates: ReviewSeedTemplate[] = [
  {
    rating: 5,
    comment: 'Sản phẩm đẹp, chất vải mềm và mặc rất vừa người. Đóng gói cũng cẩn thận.',
    moderationStatus: 'visible',
    moderationReasons: [],
    reply: 'Cảm ơn bạn đã tin tưởng và chia sẻ trải nghiệm cùng FASHIONISTA!',
    includeImage: true,
  },
  {
    rating: 4,
    comment: 'Màu sắc giống hình, form ổn. Giao hàng nhanh hơn mình dự kiến.',
    moderationStatus: 'visible',
    moderationReasons: [],
  },
  {
    rating: 2,
    comment: 'Chất liệu chưa đúng kỳ vọng, đường may ở tay áo hơi lệch.',
    moderationStatus: 'visible',
    moderationReasons: [],
  },
  {
    rating: 1,
    comment: 'Shop làm ăn lừa đảo, sản phẩm nhận được quá tệ.',
    moderationStatus: 'pending',
    moderationReasons: ['Có từ ngữ xúc phạm'],
  },
  {
    rating: 3,
    comment: 'Mọi người xem thêm ưu đãi tại https://sale-thoi-trang.example.com nhé.',
    moderationStatus: 'pending',
    moderationReasons: ['Có link quảng cáo'],
  },
  {
    rating: 3,
    comment: 'mua ngay mua ngay mua ngay mua ngay',
    moderationStatus: 'pending',
    moderationReasons: ['Spam lặp lại'],
  },
  {
    rating: 4,
    comment: 'Sản phẩm khá tốt nhưng mình muốn ẩn đánh giá này sau khi được hỗ trợ.',
    moderationStatus: 'hidden',
    moderationReasons: [],
  },
  {
    rating: 5,
    comment: 'Rất ưng thiết kế này, mình sẽ quay lại mua thêm màu khác.',
    moderationStatus: 'visible',
    moderationReasons: [],
    reply: 'FASHIONISTA rất vui vì bạn yêu thích sản phẩm. Hẹn gặp lại bạn!',
  },
];

export const seedReviewsForExistingOrders = async () => {
  // Chuẩn hóa dữ liệu từ rule cũ: số sao thấp không còn là lý do giữ đánh giá.
  await Review.updateMany(
    { moderationReasons: 'Đánh giá dưới 3 sao' },
    { $pull: { moderationReasons: 'Đánh giá dưới 3 sao' } },
  );
  await Review.updateMany(
    { moderationStatus: 'pending', moderationReasons: { $size: 0 } },
    { $set: { moderationStatus: 'visible' } },
  );

  const orders = await Order.find({ 'order_list.0': { $exists: true } })
    .sort({ createdAt: -1 })
    .select('_id user_id order_list')
    .lean<Array<{ _id: Types.ObjectId; user_id: Types.ObjectId; order_list: IOrderItem[] }>>();

  const candidates: Array<{
    userId: Types.ObjectId;
    productId: Types.ObjectId;
    orderId: Types.ObjectId;
    orderItem: IOrderItem;
  }> = [];
  const uniqueKeys = new Set<string>();

  for (const order of orders) {
    for (const item of order.order_list) {
      const key = `${order.user_id}:${item.productId}`;
      if (uniqueKeys.has(key)) continue;
      uniqueKeys.add(key);
      candidates.push({ userId: order.user_id, productId: item.productId, orderId: order._id, orderItem: item });
      if (candidates.length >= templates.length) break;
    }
    if (candidates.length >= templates.length) break;
  }

  if (candidates.length === 0) {
    console.log('Skipped review seed: no orders with products were found');
    return;
  }

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean<{ _id: Types.ObjectId } | null>();
  let createdRows = 0;

  for (const [index, candidate] of candidates.entries()) {
    const template = templates[index % templates.length];
    const repliedAt = template.reply ? new Date(Date.now() - index * 3_600_000) : null;
    const result = await Review.updateOne(
      { user_id: candidate.userId, product_id: candidate.productId },
      {
        $setOnInsert: {
          user_id: candidate.userId,
          product_id: candidate.productId,
          order_id: candidate.orderId,
          order_item_id: candidate.orderItem._id,
          rating: template.rating,
          comment: template.comment,
          images: template.includeImage && candidate.orderItem.image ? [candidate.orderItem.image] : [],
          moderationStatus: template.moderationStatus,
          moderationReasons: template.moderationReasons,
          adminReply: template.reply ?? null,
          repliedAt,
          repliedBy: template.reply ? admin?._id ?? null : null,
        },
      },
      { upsert: true },
    );
    createdRows += result.upsertedCount;
  }

  const affectedProductIds = [...new Set(candidates.map((candidate) => candidate.productId.toString()))]
    .map((id) => new Types.ObjectId(id));
  const summaries = await Review.aggregate<{ _id: Types.ObjectId; averageRating: number; reviewCount: number }>([
    {
      $match: {
        product_id: { $in: affectedProductIds },
        $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }],
      },
    },
    { $group: { _id: '$product_id', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  const summaryByProduct = new Map(summaries.map((summary) => [summary._id.toString(), summary]));

  await Promise.all(affectedProductIds.map((productId) => {
    const summary = summaryByProduct.get(productId.toString());
    return Product.updateOne(
      { _id: productId },
      { $set: { averageRating: summary ? Math.round(summary.averageRating * 10) / 10 : 0, reviewCount: summary?.reviewCount ?? 0 } },
    );
  }));

  console.log(createdRows > 0
    ? `Seeded ${createdRows} sample reviews from existing orders`
    : 'Sample reviews already seeded');
};
