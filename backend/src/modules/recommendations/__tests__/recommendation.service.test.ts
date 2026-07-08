import { Types } from 'mongoose';
import {
  RecommendationEvent,
  RecommendationRequest,
} from '../../../database/models';
import { recommendationService } from '../recommendation.service';
import type { RecommendationResponse } from '../recommendation.types';

jest.mock('../../../database/models', () => ({
  Cart: {},
  Inventory: {},
  Order: {},
  Product: {},
  RecommendationEvent: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  RecommendationRequest: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  UserProductInteraction: {},
  RECOMMENDATION_CONTEXTS: ['home', 'product_detail_similar', 'cart'],
  RECOMMENDATION_EVENT_TYPES: ['impression', 'click', 'add_to_cart', 'purchase'],
}));

jest.mock('../../interactions/interaction.service', () => ({
  INTERACTION_ACTION_WEIGHTS: {
    view: 1,
    search: 2,
    favorite: 3,
    add_to_cart: 5,
    purchase: 10,
  },
}));

const mockedRecommendationEvent = RecommendationEvent as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
};
const mockedRecommendationRequest = RecommendationRequest as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
};

const userId = new Types.ObjectId('665000000000000000000020');
const productId = new Types.ObjectId('665000000000000000000003');
const otherProductId = new Types.ObjectId('665000000000000000000004');
const eventId = new Types.ObjectId('665000000000000000000030');
const requestId = 'rec_issued_request';
const sessionId = 'rec_session_test';

const response: RecommendationResponse = {
  requestId,
  algorithmVersion: 'v1_hybrid_rule_based',
  fallbackUsed: false,
  items: [
    {
      product: { _id: productId.toString() } as never,
      score: 0.42,
      rank: 1,
      reason: 'Cung danh muc',
      reasonCodes: ['same_category'],
    },
  ],
};

const issuedRequest = {
  userId,
  sessionId,
  context: 'home',
  sourceProductId: null,
  algorithmVersion: 'v1_hybrid_rule_based',
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
        algorithmVersion: 'v1_hybrid_rule_based',
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
      algorithmVersion: 'v1_hybrid_rule_based',
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
      algorithmVersion: 'v1_hybrid_rule_based',
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
});
