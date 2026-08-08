import mongoose, { Types } from 'mongoose';
import { Order, Product, Review, ReviewHelpfulVote, User } from '../../../database/models';
import { reviewService } from '../review.service';

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../database/models', () => ({
  Order: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
  Product: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
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
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  },
  ReviewHelpfulVote: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
  User: {
    find: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedReview = Review as jest.Mocked<typeof Review>;
const mockedHelpfulVote = ReviewHelpfulVote as jest.Mocked<typeof ReviewHelpfulVote>;
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
  status: 'completed',
  paymentStatus: 'paid',
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
  criteria: null,
  images: [],
  moderationStatus: 'visible',
  moderationReasons: [],
  moderationHistory: [],
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
    mockedReview.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
    mockedHelpfulVote.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 } as never);
    mockedHelpfulVote.find.mockReturnValue(query([]) as never);
    mockedUser.find.mockReturnValue(query([]) as never);
    mockedProduct.find.mockReturnValue(query([]) as never);
  });

  it('reports eligibility only when a completed, paid order exists and no review exists', async () => {
    mockedProduct.findOne.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);

    const result = await reviewService.getEligibility(
      userId.toString(),
      orderId.toString(),
      orderItemId.toString(),
    );

    expect(mockedOrder.findOne).toHaveBeenCalledWith({
      _id: orderId,
      user_id: userId,
    });
    expect(result).toEqual({
      canReview: true,
      reason: null,
      orderStatus: 'completed',
      paymentStatus: 'paid',
      reviewId: null,
      reviewStatus: null,
    });
  });

  it('reports an existing review even when the purchased product is no longer active', async () => {
    const reviewId = new Types.ObjectId();
    mockedProduct.findOne.mockReturnValue(query(null) as never);
    mockedReview.findOne.mockReturnValue(query({
      _id: reviewId,
      moderationStatus: 'hidden',
      moderationReasons: [],
    }) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);

    await expect(reviewService.getEligibility(
      userId.toString(),
      orderId.toString(),
      orderItemId.toString(),
    )).resolves.toEqual({
      canReview: false,
      reason: 'ALREADY_REVIEWED',
      orderStatus: 'completed',
      paymentStatus: 'paid',
      reviewId: reviewId.toString(),
      reviewStatus: 'hidden',
    });
  });

  it('rejects malformed object ids as a review validation error', async () => {
    await expect(reviewService.getEligibility(
      userId.toString(),
      'invalid-id',
      orderItemId.toString(),
    )).rejects.toMatchObject({
      message: 'Invalid orderId',
      statusCode: 400,
    });

    expect(mockedOrder.findOne).not.toHaveBeenCalled();
  });

  it('lists completed order items with independent review eligibility', async () => {
    mockedOrder.find.mockReturnValue(query([{ ...eligibleOrder, orderCode: 'FS-001', deliveredAt: new Date() }]) as never);
    mockedReview.find.mockReturnValue(query([]) as never);
    mockedProduct.find.mockReturnValue(query([{ _id: productId }]) as never);

    const result = await reviewService.listEligibleItems(userId.toString(), {
      productId: productId.toString(),
      status: 'eligible',
    });

    expect(mockedOrder.find).toHaveBeenCalledWith({
      user_id: userId,
      status: 'completed',
      paymentStatus: 'paid',
      'order_list.productId': productId,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        orderId: orderId.toString(),
        orderItemId: orderItemId.toString(),
        canReview: true,
        review: null,
      }),
    ]);
  });

  it('rejects creating a review when the customer has no eligible order', async () => {
    mockedOrder.findOne.mockReturnValue(query(null) as never);

    await expect(reviewService.createReview(userId.toString(), {
      orderId: orderId.toString(),
      orderItemId: orderItemId.toString(),
      rating: 5,
      comment: 'Sản phẩm tốt',
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(mockedReview.create).not.toHaveBeenCalled();
  });

  it('rejects a second review for the same order item', async () => {
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);
    mockedProduct.findOne.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query({ _id: reviewId }) as never);

    await expect(reviewService.createReview(userId.toString(), {
      orderId: orderId.toString(),
      orderItemId: orderItemId.toString(),
      rating: 4,
      comment: 'Khá tốt',
    })).rejects.toMatchObject({
      message: 'This order item has already been reviewed',
      statusCode: 409,
    });

    expect(mockedReview.create).not.toHaveBeenCalled();
  });

  it('creates a verified review from the matching purchased order item', async () => {
    mockedProduct.findOne.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);
    mockedReview.create.mockResolvedValue([{ _id: reviewId }] as never);
    mockedReview.findById.mockReturnValue(query(populatedReview()) as never);
    mockedReview.aggregate.mockReturnValue(aggregateQuery([{ averageRating: 5, reviewCount: 1 }]) as never);

    const result = await reviewService.createReview(userId.toString(), {
      orderId: orderId.toString(),
      orderItemId: orderItemId.toString(),
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
    mockedProduct.findOne.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.findOne.mockReturnValue(query(null) as never);
    mockedOrder.findOne.mockReturnValue(query(eligibleOrder) as never);
    mockedReview.create.mockResolvedValue([{ _id: reviewId }] as never);
    mockedReview.findById.mockReturnValue(query(populatedReview({
      comment: 'Sản phẩm đồ ngu',
      moderationStatus: 'pending',
      moderationReasons: ['Có từ ngữ xúc phạm'],
    })) as never);

    await reviewService.createReview(userId.toString(), {
      orderId: orderId.toString(),
      orderItemId: orderItemId.toString(),
      rating: 1,
      comment: 'Sản phẩm đồ ngu',
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

  it('excludes hidden reviews from the public response and pagination', async () => {
    mockedReview.find.mockReturnValue(query([]) as never);
    mockedReview.countDocuments.mockResolvedValue(0);
    mockedProduct.findById.mockReturnValue(query({ _id: productId, averageRating: 4.9, reviewCount: 999 }) as never);
    mockedReview.aggregate.mockReturnValue(aggregateQuery([]) as never);

    const result = await reviewService.listProductReviews(productId.toString());

    const expectedFilter = {
      product_id: productId,
      $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }],
    };
    expect(mockedReview.find).toHaveBeenCalledWith(expectedFilter);
    expect(mockedReview.countDocuments).toHaveBeenCalledWith(expectedFilter);
    expect(result.items).toEqual([]);
    expect(result.summary).toEqual({
      averageRating: 0,
      reviewCount: 0,
      distribution: [
        { rating: 5, count: 0, percent: 0 },
        { rating: 4, count: 0, percent: 0 },
        { rating: 3, count: 0, percent: 0 },
        { rating: 2, count: 0, percent: 0 },
        { rating: 1, count: 0, percent: 0 },
      ],
    });
    expect(result.pagination.totalItems).toBe(0);
  });

  it('builds the public review summary from visible review rows', async () => {
    mockedReview.find.mockReturnValue(query([]) as never);
    mockedReview.countDocuments.mockResolvedValue(3);
    mockedProduct.findById.mockReturnValue(query({ _id: productId, averageRating: 1.2, reviewCount: 500 }) as never);
    mockedReview.aggregate.mockReturnValue(aggregateQuery([
      { _id: 5, count: 2 },
      { _id: 3, count: 1 },
    ]) as never);

    const result = await reviewService.listProductReviews(productId.toString());

    expect(result.summary.averageRating).toBe(4.3);
    expect(result.summary.reviewCount).toBe(3);
    expect(result.summary.distribution).toEqual([
      { rating: 5, count: 2, percent: 67 },
      { rating: 4, count: 0, percent: 0 },
      { rating: 3, count: 1, percent: 33 },
      { rating: 2, count: 0, percent: 0 },
      { rating: 1, count: 0, percent: 0 },
    ]);
  });

  it('restores the current customer helpful votes when listing public reviews', async () => {
    const visibleReview = populatedReview();
    mockedReview.find.mockReturnValue(query([visibleReview]) as never);
    mockedReview.countDocuments.mockResolvedValue(1);
    mockedProduct.findById.mockReturnValue(query({ _id: productId }) as never);
    mockedReview.aggregate.mockReturnValue(aggregateQuery([{ _id: 5, count: 1 }]) as never);
    mockedHelpfulVote.find.mockReturnValue(query([{ review_id: reviewId }]) as never);

    const result = await reviewService.listProductReviews(
      productId.toString(),
      {},
      userId.toString(),
    );

    expect(mockedHelpfulVote.find).toHaveBeenCalledWith({
      review_id: { $in: [reviewId] },
      user_id: userId,
    });
    expect(result.items[0].hasVotedHelpful).toBe(true);
  });

  it('applies rating and sort filters when listing the current customer reviews', async () => {
    const myReview = populatedReview({
      product_id: { _id: productId, name: 'Basic Tee', product_image: 'tee.png' },
      adminReply: 'Cảm ơn bạn đã chia sẻ trải nghiệm.',
      repliedAt: new Date('2026-06-02T00:00:00.000Z'),
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
    expect(result.items[0]).toMatchObject({
      orderId: orderId.toString(),
      orderItemId: orderItemId.toString(),
      adminReply: {
        content: 'Cảm ơn bạn đã chia sẻ trải nghiệm.',
        repliedAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    });
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
      { userId: userId.toString(), role: 'admin' },
      'Vi phạm tiêu chuẩn cộng đồng',
    );

    expect(mockedReview.updateOne).toHaveBeenCalledTimes(2);
    expect(mockedProduct.updateOne).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ updatedCount: 2, skippedCount: 0, status: 'hidden' });
  });

  it('toggles a helpful vote and synchronizes the cached count', async () => {
    mockedReview.findById.mockReturnValue(query({
      _id: reviewId,
      user_id: new Types.ObjectId('665000000000000000000010'),
      moderationStatus: 'visible',
      helpfulCount: 0,
    }) as never);
    mockedHelpfulVote.findOneAndDelete.mockResolvedValue(null);
    mockedHelpfulVote.create.mockResolvedValue([{ _id: new Types.ObjectId() }] as never);
    mockedHelpfulVote.countDocuments.mockReturnValue(query(1) as never);

    const result = await reviewService.toggleHelpfulVote(userId.toString(), reviewId.toString());

    expect(mockedHelpfulVote.create).toHaveBeenCalledWith(
      [{ review_id: reviewId, user_id: userId }],
      { session: mockSession },
    );
    expect(mockedReview.updateOne).toHaveBeenCalledWith(
      {
        _id: reviewId,
        $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }],
      },
      { $set: { helpfulCount: 1 } },
      { session: mockSession },
    );
    expect(result).toEqual({ reviewId: reviewId.toString(), helpfulCount: 1, hasVotedHelpful: true });
  });

  it('rejects and rolls back a helpful vote when the review becomes hidden or deleted', async () => {
    mockedReview.findById.mockReturnValue(query({
      _id: reviewId,
      user_id: new Types.ObjectId('665000000000000000000010'),
      moderationStatus: 'visible',
      helpfulCount: 0,
    }) as never);
    mockedHelpfulVote.findOneAndDelete.mockResolvedValue(null);
    mockedHelpfulVote.create.mockResolvedValue([{ _id: new Types.ObjectId() }] as never);
    mockedHelpfulVote.countDocuments.mockReturnValue(query(1) as never);
    mockedReview.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0 } as never);

    await expect(reviewService.toggleHelpfulVote(userId.toString(), reviewId.toString()))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(mockedReview.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: reviewId,
        $or: [{ moderationStatus: 'visible' }, { moderationStatus: { $exists: false } }],
      }),
      { $set: { helpfulCount: 1 } },
      { session: mockSession },
    );
  });

  it('does not append moderation history when the requested state is unchanged', async () => {
    const reviewDocument = {
      ...populatedReview({ moderationStatus: 'visible', moderationReasons: [] }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedReview.findById.mockReturnValue(query(reviewDocument) as never);

    const result = await reviewService.updateModerationStatus(
      reviewId.toString(),
      'visible',
      { userId: userId.toString(), role: 'admin' },
    );

    expect(result).toEqual({ reviewId: reviewId.toString(), status: 'visible' });
    expect(reviewDocument.save).not.toHaveBeenCalled();
    expect(mockedProduct.updateOne).not.toHaveBeenCalled();
    expect(reviewDocument.moderationHistory).toEqual([]);
  });

  it('skips unchanged reviews during bulk moderation', async () => {
    mockedReview.find.mockReturnValue(query([{
      _id: reviewId,
      product_id: productId,
      moderationStatus: 'hidden',
      moderationReasons: ['Nội dung vi phạm'],
    }]) as never);

    const result = await reviewService.updateManyModerationStatuses(
      [reviewId.toString()],
      'hidden',
      { userId: userId.toString(), role: 'admin' },
      'Nội dung vi phạm',
    );

    expect(result).toEqual({ updatedCount: 0, skippedCount: 1, status: 'hidden' });
    expect(mockedReview.updateOne).not.toHaveBeenCalled();
    expect(mockedProduct.updateOne).not.toHaveBeenCalled();
  });

  it('rejects marking the current customer own review as helpful', async () => {
    mockedReview.findById.mockReturnValue(query({
      _id: reviewId,
      user_id: userId,
      moderationStatus: 'visible',
      helpfulCount: 0,
    }) as never);

    await expect(reviewService.toggleHelpfulVote(userId.toString(), reviewId.toString()))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mockedHelpfulVote.create).not.toHaveBeenCalled();
  });

  it('rejects replying to a hidden review', async () => {
    mockedReview.findById.mockReturnValue(query({
      ...populatedReview({ moderationStatus: 'hidden' }),
      save: jest.fn(),
    }) as never);

    await expect(reviewService.replyToReview(
      reviewId.toString(),
      { userId: userId.toString(), role: 'admin' },
      'Cảm ơn bạn đã phản hồi',
    )).rejects.toMatchObject({ statusCode: 409 });
  });

  it('deletes an admin reply inside the review transaction', async () => {
    const reviewDocument = {
      ...populatedReview({ adminReply: 'Phản hồi cũ', repliedAt: new Date() }),
      repliedBy: userId,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedReview.findById.mockReturnValue(query(reviewDocument) as never);

    const result = await reviewService.deleteReviewReply(
      reviewId.toString(),
      { userId: userId.toString(), role: 'admin' },
    );

    expect(reviewDocument.adminReply).toBeNull();
    expect(reviewDocument.repliedAt).toBeNull();
    expect(reviewDocument.repliedBy).toBeNull();
    expect(reviewDocument.save).toHaveBeenCalledWith({ session: mockSession });
    expect(result).toEqual({ reviewId: reviewId.toString(), deleted: true });
  });
});
