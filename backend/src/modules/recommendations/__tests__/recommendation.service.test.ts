import { Types } from 'mongoose';
import {
  RecommendationEvent,
  RecommendationRequest,
} from '../../../database/models';
import {
  applyRecommendationDiversity,
  calculateCartRecommendationScore,
  calculatePersonalRecommendationScore,
  calculateSimilarRecommendationScore,
  getCartComplementaryRoleScore,
  inferOutfitRole,
  recommendationService,
} from '../recommendation.service';
import {
  RECOMMENDATION_ALGORITHM_VERSION,
  type RecommendationResponse,
} from '../recommendation.types';
import { interactionService } from '../../interactions/interaction.service';
import { CART_RULE_ONLY_FALLBACK_WEIGHTS } from '../recommendation-scoring';

jest.mock('../../../database/models', () => ({
  Cart: {},
  Inventory: {},
  Order: {},
  Product: {},
  RecommendationEvent: {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
  RecommendationRequest: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  UserProductInteraction: {},
  RECOMMENDATION_CONTEXTS: ['home', 'product_detail_similar', 'cart'],
  RECOMMENDATION_EVENT_TYPES: [
    'impression',
    'click',
    'add_to_cart',
    'purchase',
    'order_created',
    'payment_completed',
    'order_cancelled',
    'order_returned',
  ],
}));

jest.mock('../../interactions/interaction.service', () => ({
  INTERACTION_ACTION_WEIGHTS: {
    view: 1,
    click: 1,
    search: 2,
    favorite: 3,
    add_to_cart: 5,
    purchase: 10,
    search_result_click: 2,
    recommendation_click: 3,
    try_on: 4,
  },
  interactionService: {
    recordInteractionBestEffort: jest.fn(),
  },
}));

const mockedRecommendationEvent = RecommendationEvent as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
  updateOne: jest.Mock;
};
const mockedRecommendationRequest = RecommendationRequest as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
};
const mockedInteractionService = interactionService as jest.Mocked<typeof interactionService>;

const userId = new Types.ObjectId('665000000000000000000020');
const productId = new Types.ObjectId('665000000000000000000003');
const otherProductId = new Types.ObjectId('665000000000000000000004');
const eventId = new Types.ObjectId('665000000000000000000030');
const requestId = 'rec_issued_request';
const sessionId = 'rec_session_test';

const response: RecommendationResponse = {
  requestId,
  algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
  fallbackUsed: false,
  items: [
    {
      product: { _id: productId.toString() } as never,
      score: 0.42,
      rank: 1,
      reason: 'Cùng danh mục',
      reasonCodes: ['same_category'],
    },
  ],
};

const issuedRequest = {
  userId,
  sessionId,
  context: 'home',
  sourceProductId: null,
  algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
  items: [
    {
      productId,
      score: 0.42,
      rank: 1,
      reasonCodes: ['same_category'],
    },
  ],
};

const mockIssuedRequest = (value: unknown) => {
  mockedRecommendationRequest.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  });
};

const mockExistingEvent = (value: unknown) => {
  mockedRecommendationEvent.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  });
};

describe('recommendation ranking', () => {
  it('uses the validation-selected Product Detail content/cosine hybrid', () => {
    expect(calculateSimilarRecommendationScore({
      contentSimilarity: 1,
      cosineSimilarity: 0,
      popularity: 1,
      business: 1,
    })).toBeCloseTo(0.125);
    expect(calculateSimilarRecommendationScore({
      contentSimilarity: 0,
      cosineSimilarity: 1,
      popularity: 0,
      business: 0,
    })).toBeCloseTo(0.875);
  });

  it('infers outfit roles from Vietnamese product and category names', () => {
    expect(inferOutfitRole({
      name: 'Bộ Quần Áo Thể Thao Nữ Thấm Hút Tốt',
      categoryName: 'Bộ thể thao',
    })).toBe('set');
    expect(inferOutfitRole({
      name: 'Áo len nam bộ gia đình cổ tròn',
      categoryName: 'Áo len',
    })).toBe('top');
    expect(inferOutfitRole({
      name: 'Giày nam derby da bò nappa sang trọng',
      categoryName: 'Giày / Dép khác',
    })).toBe('shoes');
    expect(inferOutfitRole({
      name: 'Quần Âu Nữ Dáng Suông',
      categoryName: 'Quần âu',
    })).toBe('bottom');
  });

  it('prioritizes missing complementary roles over roles already in the cart', () => {
    expect(getCartComplementaryRoleScore(['top'], 'bottom')).toBe(1);
    expect(getCartComplementaryRoleScore(['top'], 'shoes')).toBe(0.55);
    expect(getCartComplementaryRoleScore(['top', 'bottom'], 'shoes')).toBe(0.75);
    expect(getCartComplementaryRoleScore(['top', 'bottom'], 'top')).toBe(0.2);
  });

  it('uses the validation-tuned association hybrid cart score', () => {
    expect(calculateCartRecommendationScore({
      complementaryRole: 1,
      styleCompatibility: 0,
      popularity: 0,
      business: 0,
    })).toBeCloseTo(0.2);
    expect(calculateCartRecommendationScore({
      complementaryRole: 0,
      styleCompatibility: 1,
      popularity: 1,
      business: 1,
    })).toBeCloseTo(0.3);
    expect(calculateCartRecommendationScore({
      complementaryRole: 0,
      styleCompatibility: 0,
      popularity: 0,
      business: 0,
      associationLift: 1,
    })).toBeCloseTo(0.5);
  });

  it('uses purchase association to distinguish plausible cart complements', () => {
    const trousersScore = calculateCartRecommendationScore({
      complementaryRole: getCartComplementaryRoleScore(['top'], 'bottom'),
      styleCompatibility: 0.4,
      popularity: 0,
      business: 0,
      associationLift: 0.8,
    });
    const shoesScore = calculateCartRecommendationScore({
      complementaryRole: getCartComplementaryRoleScore(['top'], 'shoes'),
      styleCompatibility: 1,
      popularity: 1,
      business: 1,
      associationLift: 0.1,
    });

    expect(trousersScore).toBeGreaterThan(shoesScore);
  });

  it('falls back to the rule-only cart formula when association evidence is unavailable', () => {
    expect(calculateCartRecommendationScore({
      complementaryRole: 1,
      styleCompatibility: 0,
      popularity: 0,
      business: 0,
      associationLift: 0,
    }, CART_RULE_ONLY_FALLBACK_WEIGHTS)).toBeCloseTo(0.65);
  });

  it('uses the validation-tuned personal score', () => {
    expect(calculatePersonalRecommendationScore({
      preferenceMatch: 1,
      popularity: 0,
      business: 0,
    })).toBeCloseTo(0.9);
    expect(calculatePersonalRecommendationScore({
      preferenceMatch: 0,
      popularity: 1,
      business: 1,
    })).toBeCloseTo(0.1);
  });

  it('limits repeated categories and brands when alternatives exist', () => {
    const item = (id: string, categoryId: string, brandId: string, score: number) => ({
      score,
      productItem: {
        _id: id,
        category: { _id: categoryId },
        brand: { _id: brandId },
      },
    });
    const items = [
      item('one', 'category-a', 'brand-x', 1),
      item('two', 'category-a', 'brand-x', 0.99),
      item('three', 'category-a', 'brand-x', 0.98),
      item('four', 'category-b', 'brand-y', 0.97),
      item('five', 'category-c', 'brand-z', 0.96),
      item('six', 'category-d', 'brand-w', 0.95),
    ];

    const result = applyRecommendationDiversity(items, 4);

    expect(result.map((entry) => entry.productItem._id)).toEqual([
      'one',
      'four',
      'five',
      'six',
    ]);
  });
});

describe('recommendationService event integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssuedRequest(issuedRequest);
    mockExistingEvent(null);
    mockedRecommendationRequest.create.mockResolvedValue({ requestId });
    mockedRecommendationEvent.create.mockResolvedValue({ _id: eventId });
  });

  it('registers the server-issued recommendation batch', async () => {
    const result = await recommendationService.registerRecommendationRequest({
      response,
      context: 'home',
      userId: userId.toString(),
      sessionId,
    });

    expect(mockedRecommendationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        userId,
        sessionId,
        context: 'home',
        algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
        items: [
          {
            productId,
            score: 0.42,
            rank: 1,
            reasonCodes: ['same_category'],
          },
        ],
      }),
    );
    expect(result).toEqual({ registered: true, requestId });
  });

  it('records event metadata from the issued batch instead of client values', async () => {
    const result = await recommendationService.recordRecommendationEvent({
      userId: userId.toString(),
      sessionId,
      context: 'home',
      recommendedProductId: productId.toString(),
      requestId,
      eventType: 'impression',
      algorithmVersion: 'client_forged',
      score: 0.99,
      rank: 9,
      reasonCodes: ['popular'],
    });

    expect(mockedRecommendationEvent.create).toHaveBeenCalledWith({
      userId,
      sessionId,
      context: 'home',
      sourceProductId: null,
      recommendedProductId: productId,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      score: 0.42,
      rank: 1,
      reasonCodes: ['same_category'],
      eventType: 'impression',
      requestId,
    });
    expect(result).toEqual({ recorded: true, eventId: eventId.toString() });
  });

  it('rejects products that were not part of the issued batch', async () => {
    await expect(
      recommendationService.recordRecommendationEvent({
        userId: userId.toString(),
        sessionId,
        context: 'home',
        recommendedProductId: otherProductId.toString(),
        requestId,
        eventType: 'click',
      }),
    ).rejects.toMatchObject({
      message: 'Product was not issued in this recommendation request',
      statusCode: 400,
    });

    expect(mockedRecommendationEvent.create).not.toHaveBeenCalled();
  });

  it('adds a preference-profile interaction for a recorded click', async () => {
    await recommendationService.recordRecommendationEvent({
      userId: userId.toString(),
      sessionId,
      context: 'home',
      recommendedProductId: productId.toString(),
      requestId,
      eventType: 'click',
    });

    expect(mockedInteractionService.recordInteractionBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userId.toString(),
        sessionId,
        productId: productId.toString(),
        actionType: 'recommendation_click',
        source: 'recommendation',
        metadata: expect.objectContaining({
          recommendationRequestId: requestId,
          recommendationRank: 1,
        }),
      }),
      'Failed to record recommendation click interaction',
    );
  });

  it('does not duplicate the same event for one request and product', async () => {
    mockExistingEvent({ _id: eventId });

    const result = await recommendationService.recordRecommendationEvent({
      userId: userId.toString(),
      sessionId,
      context: 'home',
      recommendedProductId: productId.toString(),
      requestId,
      eventType: 'click',
    });

    expect(result).toEqual({ recorded: false, eventId: eventId.toString() });
    expect(mockedRecommendationEvent.create).not.toHaveBeenCalled();
  });

  it('keeps guest attribution when the same session adds to cart after login', async () => {
    const sourceEvent = {
      sessionId,
      context: 'home',
      sourceProductId: null,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      score: 0.42,
      rank: 1,
      reasonCodes: ['same_category'],
    };

    mockedRecommendationEvent.findOne.mockImplementation(
      (filter: { eventType: string }) => {
        if (filter.eventType === 'click') {
          return {
            sort: jest.fn().mockResolvedValue(sourceEvent),
          };
        }

        if (filter.eventType === 'impression' || filter.eventType === 'add_to_cart') {
          return filter.eventType === 'add_to_cart'
            ? {
                sort: jest.fn().mockResolvedValue(null),
                select: jest.fn().mockReturnValue({
                  lean: jest.fn().mockResolvedValue(null),
                }),
              }
            : { sort: jest.fn().mockResolvedValue(null) };
        }

        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        };
      },
    );

    const result = await recommendationService.recordRecommendationConversionEvent({
      userId: userId.toString(),
      sessionId,
      requestId,
      recommendedProductId: productId.toString(),
      eventType: 'add_to_cart',
    });

    expect(mockedRecommendationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        sessionId,
        requestId,
        recommendedProductId: productId,
        eventType: 'add_to_cart',
      }),
    );
    expect(result).toEqual({ recorded: true, eventId: eventId.toString() });
  });

  it('records payment completion against the original request and order', async () => {
    const orderId = new Types.ObjectId('665000000000000000000030');
    const sourceEvent = {
      sessionId,
      context: 'home',
      sourceProductId: null,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      score: 0.42,
      rank: 1,
      reasonCodes: ['same_category'],
    };
    mockedRecommendationEvent.findOne.mockImplementation((filter: { eventType: string }) => {
      if (filter.eventType === 'order_created') {
        return { sort: jest.fn().mockResolvedValue(sourceEvent) };
      }

      return {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      };
    });

    const result = await recommendationService.recordRecommendationConversionEvent({
      userId: userId.toString(),
      requestId,
      recommendedProductId: productId.toString(),
      eventType: 'payment_completed',
      orderId: orderId.toString(),
      orderCode: 'FSORDER',
      orderStatus: 'confirmed',
      orderPaymentStatus: 'paid',
      quantity: 2,
      attributedAmount: 360000,
    });

    expect(mockedRecommendationEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      sessionId,
      requestId,
      recommendedProductId: productId,
      eventType: 'payment_completed',
      schemaVersion: 2,
      orderId,
      orderCode: 'FSORDER',
      orderStatus: 'confirmed',
      orderPaymentStatus: 'paid',
      quantity: 2,
      attributedAmount: 360000,
      reversesPayment: false,
    }));
    expect(result).toEqual({ recorded: true, eventId: eventId.toString() });
  });

  it('upgrades an existing cancellation to a paid reversal without duplicating it', async () => {
    const orderId = new Types.ObjectId('665000000000000000000031');
    const sourceEvent = {
      sessionId,
      context: 'home',
      sourceProductId: null,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      score: 0.42,
      rank: 1,
      reasonCodes: ['same_category'],
    };
    mockedRecommendationEvent.findOne.mockImplementation((filter: { eventType: string }) => {
      if (filter.eventType === 'order_created') {
        return { sort: jest.fn().mockResolvedValue(sourceEvent) };
      }

      return {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: eventId }),
        }),
      };
    });

    const result = await recommendationService.recordRecommendationConversionEvent({
      userId: userId.toString(),
      requestId,
      recommendedProductId: productId.toString(),
      eventType: 'order_cancelled',
      orderId: orderId.toString(),
      orderStatus: 'cancelled',
      orderPaymentStatus: 'paid',
      reversesPayment: true,
    });

    expect(mockedRecommendationEvent.updateOne).toHaveBeenCalledWith(
      { _id: eventId },
      {
        $set: {
          reversesPayment: true,
          orderStatus: 'cancelled',
          orderPaymentStatus: 'paid',
        },
      },
    );
    expect(mockedRecommendationEvent.create).not.toHaveBeenCalled();
    expect(result).toEqual({ recorded: false, eventId: eventId.toString() });
  });
});
