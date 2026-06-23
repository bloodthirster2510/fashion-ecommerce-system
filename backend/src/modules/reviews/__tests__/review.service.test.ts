import mongoose, { Types } from 'mongoose';
import { Order, Product, Review, User } from '../../../database/models';
import { reviewService } from '../review.service';

jest.mock('../../../database/models', () => ({
  Order: {
    findOne: jest.fn(),
  },
  Product: {
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
  Review: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    updateMany: jest.fn(),
  },
  User: {
    find: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedReview = Review as jest.Mocked<typeof Review>;
const mockedUser = User as jest.Mocked<typeof User>;

const userId = new Types.ObjectId('665000000000000000000001');
const productId = new Types.ObjectId('665000000000000000000002');
const reviewId = new Types.ObjectId('665000000000000000000003');
const orderId = new Types.ObjectId('665000000000000000000004');
const orderItemId = new Types.ObjectId('665000000000000000000005');
const variantId = new Types.ObjectId('665000000000000000000006');
const colorVariantId = new Types.ObjectId('665000000000000000000007');

type QueryResult = unknown;

// Mock Mongoose query chain đủ những method service đang gọi.
// Các method trả lại chính chain để test kiểm được sort/skip/limit/session mà không cần DB thật.
const query = (result: QueryResult) => {
  const promise = Promise.resolve(result);
  const chain = {
    lean: jest.fn().mockResolvedValue(result),
    limit: jest.fn(),
    populate: jest.fn(),
    select: jest.fn(),
    session: jest.fn(),
    skip: jest.fn(),
    sort: jest.fn(),
    then: promise.then.bind(promise),
  };
  chain.limit.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.session.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  return chain;
};

// Aggregate trong service vừa await được vừa có thể gắn session trong transaction.
const aggregateQuery = (result: unknown[]) => {
  const promise = Promise.resolve(result);
  return {
    session: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
  };
};

const mockSession = {
  endSession: jest.fn(),
  // Chạy callback ngay để test tập trung vào side-effect thay vì mô phỏng Mongo transaction thật.
  withTransaction: jest.fn(async (operation: () => Promise<void>) => operation()),
};

const startSessionSpy = jest.spyOn(mongoose, 'startSession');

const purchasedItem = {
  _id: orderItemId,
  productId,
  variantId,
  colorVariantId,
  fitType: 'Regular',
  color: 'Black',
  size: 'M',
  sku: 'TEE-BLK-M',
  name: 'Basic Tee',
  image: 'tee.png',
  quantity: 1,
  priceAtPurchased: 199000,
};

const eligibleOrder = {
  _id: orderId,
  order_list: [purchasedItem],
};

const populatedReview = (overrides: Record<string, unknown> = {}) => ({
  _id: reviewId,
  user_id: { _id: userId, name: 'Customer', avatarImage: null },
  product_id: productId,
  order_id: eligibleOrder,
  order_item_id: orderItemId,
  rating: 5,
  comment: 'Sản phẩm tốt',
  images: [],
  moderationStatus: 'visible',
  moderationReasons: [],
  adminReply: null,
  repliedAt: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  ...overrides,
});

describe('reviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    startSessionSpy.mockResolvedValue(mockSession as never);
    mockedProduct.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
    mockedReview.aggregate.mockReturnValue(aggregateQuery([]) as never);
    mockedReview.countDocuments.mockResolvedValue(0);
    mockedReview.updateMany.mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0 } as never);
    mockedUser.find.mockReturnValue(query([]) as never);
    mockedProduct.find.mockReturnValue(query([]) as never);
  });

  it('reports eligibility only when a delivered, paid order exists and no review exists', async () => {
    mockedProduct.findById.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);

    const result = await reviewService.getEligibility(userId.toString(), productId.toString());

    expect(mockedOrder.findOne).toHaveBeenCalledWith({
      user_id: userId,
      status: 'delivered',
      paymentStatus: 'paid',
      'order_list.productId': productId,
    });
    expect(result).toEqual({
      productId: productId.toString(),
      canReview: true,
      hasPurchased: true,
      hasReviewed: false,
      reviewId: null,
      reviewStatus: null,
      moderationReasons: [],
    });
  });

  it('rejects malformed object ids as a review validation error', async () => {
    await expect(reviewService.getEligibility(userId.toString(), 'invalid-id')).rejects.toMatchObject({
      message: 'Invalid productId',
      statusCode: 400,
    });

    expect(mockedProduct.findById).not.toHaveBeenCalled();
  });

  it('rejects creating a review when the customer has no eligible order', async () => {
    mockedProduct.findById.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(null) as never);

    await expect(reviewService.createReview(userId.toString(), {
      productId: productId.toString(),
      rating: 5,
      comment: 'Sản phẩm tốt',
    })).rejects.toMatchObject({ statusCode: 403 });

    expect(mockedReview.create).not.toHaveBeenCalled();
  });

  it('rejects a second review for the same customer and product', async () => {
    mockedProduct.findById.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query({ _id: reviewId }) as never);

    await expect(reviewService.createReview(userId.toString(), {
      productId: productId.toString(),
      rating: 4,
      comment: 'Khá tốt',
    })).rejects.toMatchObject({
      message: 'You have already reviewed this product',
      statusCode: 409,
    });

    expect(mockedOrder.findOne).not.toHaveBeenCalled();
    expect(mockedReview.create).not.toHaveBeenCalled();
  });

  it('creates a verified review from the matching purchased order item', async () => {
    mockedProduct.findById.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);
    mockedReview.create.mockResolvedValue([{ _id: reviewId }] as never);
    mockedReview.findById.mockReturnValue(query(populatedReview()) as never);
    mockedReview.aggregate.mockReturnValue(aggregateQuery([{ averageRating: 5, reviewCount: 1 }]) as never);

    const result = await reviewService.createReview(userId.toString(), {
      productId: productId.toString(),
      rating: 5,
      comment: '  Sản phẩm tốt  ',
    });

    expect(mockedReview.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        user_id: userId,
        product_id: productId,
        order_id: orderId,
        order_item_id: orderItemId,
        rating: 5,
        comment: 'Sản phẩm tốt',
        moderationStatus: 'visible',
        moderationReasons: [],
      })],
      { session: mockSession },
    );
    expect(mockedProduct.updateOne).toHaveBeenCalledWith(
      { _id: productId },
      { $set: { averageRating: 5, reviewCount: 1 } },
      { session: mockSession },
    );
    expect(result).toEqual(expect.objectContaining({
      _id: reviewId.toString(),
      verifiedPurchase: true,
      purchasedVariant: expect.objectContaining({ sku: 'TEE-BLK-M' }),
    }));
  });

  it('places an offensive review in pending moderation and excludes it from product rating', async () => {
    mockedProduct.findById.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);
    mockedReview.create.mockResolvedValue([{ _id: reviewId }] as never);
    mockedReview.findById.mockReturnValue(query(populatedReview({
      comment: 'Đồ ngu',
      moderationStatus: 'pending',
      moderationReasons: ['Có từ ngữ xúc phạm'],
    })) as never);

    await reviewService.createReview(userId.toString(), {
      productId: productId.toString(),
      rating: 1,
      comment: 'Đồ ngu',
    });

    expect(mockedReview.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        moderationStatus: 'pending',
        moderationReasons: ['Có từ ngữ xúc phạm'],
      })],
      { session: mockSession },
    );
    expect(mockedProduct.updateOne).toHaveBeenCalledWith(
      { _id: productId },
      { $set: { averageRating: 0, reviewCount: 0 } },
      { session: mockSession },
    );
  });

  it('does not let a customer update another customer review', async () => {
    mockedReview.findOne.mockReturnValue(query(null) as never);

    await expect(reviewService.updateReview(userId.toString(), reviewId.toString(), {
      rating: 1,
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(mockedReview.findOne).toHaveBeenCalledWith({ _id: reviewId, user_id: userId });
  });

  it('sends an edited hidden review back to pending instead of making it public', async () => {
    // Review đã bị admin ẩn không được tự public lại chỉ nhờ user sửa nội dung sạch hơn.
    const reviewDocument = {
      ...populatedReview({
        user_id: userId,
        order_id: orderId,
        moderationStatus: 'hidden',
        moderationReasons: ['Ẩn thủ công'],
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedReview.findOne.mockReturnValue(query(reviewDocument) as never);
    mockedReview.findById.mockReturnValue(query(populatedReview({
      comment: 'Nội dung đã sửa',
      moderationStatus: 'pending',
      moderationReasons: ['Nội dung đã chỉnh sửa cần được kiểm duyệt lại'],
    })) as never);

    await reviewService.updateReview(userId.toString(), reviewId.toString(), {
      comment: 'Nội dung đã sửa',
    });

    expect(reviewDocument.moderationStatus).toBe('pending');
    expect(reviewDocument.moderationReasons).toEqual(['Nội dung đã chỉnh sửa cần được kiểm duyệt lại']);
    expect(reviewDocument.save).toHaveBeenCalledWith({ session: mockSession });
  });

  it('keeps an admin-hidden review hidden when only its rating changes', async () => {
    const reviewDocument = {
      ...populatedReview({
        user_id: userId,
        order_id: orderId,
        moderationStatus: 'hidden',
        moderationReasons: ['Ẩn thủ công'],
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedReview.findOne.mockReturnValue(query(reviewDocument) as never);
    mockedReview.findById.mockReturnValue(query(populatedReview({
      rating: 4,
      moderationStatus: 'hidden',
      moderationReasons: ['Ẩn thủ công'],
    })) as never);

    await reviewService.updateReview(userId.toString(), reviewId.toString(), { rating: 4 });

    expect(reviewDocument.rating).toBe(4);
    expect(reviewDocument.moderationStatus).toBe('hidden');
    expect(reviewDocument.moderationReasons).toEqual(['Ẩn thủ công']);
  });

  it('does not let a customer delete another customer review', async () => {
    mockedReview.findOneAndDelete.mockResolvedValue(null);

    await expect(reviewService.deleteReview(userId.toString(), reviewId.toString()))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(mockedReview.findOneAndDelete).toHaveBeenCalledWith(
      { _id: reviewId, user_id: userId },
      { session: mockSession },
    );
    expect(mockedProduct.updateOne).not.toHaveBeenCalled();
  });

  it('hides moderated content and moderation reasons from the public response', async () => {
    const hiddenReview = populatedReview({
      moderationStatus: 'hidden',
      moderationReasons: ['Vi phạm tiêu chuẩn cộng đồng'],
    });
    mockedReview.find.mockReturnValue(query([hiddenReview]) as never);
    mockedReview.countDocuments.mockResolvedValue(1);
    mockedProduct.findById.mockReturnValue(query({ averageRating: 0, reviewCount: 0 }) as never);

    const result = await reviewService.listProductReviews(productId.toString());

    expect(result.items[0]).toEqual(expect.objectContaining({
      comment: 'Nội dung đánh giá này đã bị xóa do vi phạm tiêu chuẩn cộng đồng.',
      moderationReasons: [],
      isContentRemoved: true,
    }));
  });

  it('applies rating and sort filters when listing the current customer reviews', async () => {
    const myReview = populatedReview({
      product_id: { _id: productId, name: 'Basic Tee', product_image: 'tee.png' },
    });
    const findQuery = query([myReview]);
    mockedReview.find.mockReturnValue(findQuery as never);
    mockedReview.countDocuments.mockResolvedValue(1);

    const result = await reviewService.listMyReviews(userId.toString(), {
      rating: 5,
      sort: 'oldest',
    });

    const expectedFilter = { user_id: userId, rating: 5 };
    expect(mockedReview.find).toHaveBeenCalledWith(expectedFilter);
    expect(mockedReview.countDocuments).toHaveBeenCalledWith(expectedFilter);
    expect(findQuery.sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(result.items).toHaveLength(1);
  });

  it('deduplicates bulk moderation ids and refreshes each affected product rating', async () => {
    // UI có thể gửi trùng id khi chọn nhiều lần; service phải update một lần và refresh theo product duy nhất.
    const secondReviewId = new Types.ObjectId('665000000000000000000008');
    const secondProductId = new Types.ObjectId('665000000000000000000009');
    mockedReview.find.mockReturnValue(query([
      { _id: reviewId, product_id: productId },
      { _id: secondReviewId, product_id: secondProductId },
    ]) as never);

    const result = await reviewService.updateManyModerationStatuses(
      [reviewId.toString(), reviewId.toString(), secondReviewId.toString()],
      'hidden',
    );

    expect(mockedReview.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [reviewId, secondReviewId] } },
      { $set: { moderationStatus: 'hidden' } },
      { session: mockSession },
    );
    expect(mockedProduct.updateOne).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ updatedCount: 2, status: 'hidden' });
  });
});
