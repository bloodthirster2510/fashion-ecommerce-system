import { Types } from 'mongoose';
import { Product, UserProductInteraction } from '../../../database/models';
import { interactionService } from '../interaction.service';

jest.mock('../../../database/models', () => ({
  INTERACTION_ACTION_TYPES: [
    'view',
    'click',
    'search',
    'favorite',
    'add_to_cart',
    'purchase',
    'search_result_click',
    'recommendation_click',
    'try_on',
  ],
  INTERACTION_SOURCES: [
    'home',
    'product_list',
    'product_detail',
    'search',
    'image_search',
    'cart',
    'checkout',
    'recommendation',
    'virtual_try_on',
    'backend',
  ],
  Product: {
    exists: jest.fn(),
  },
  UserProductInteraction: {
    create: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
    updateOne: jest.fn(),
  },
}));

const mockedProduct = Product as unknown as { exists: jest.Mock };
const mockedInteraction = UserProductInteraction as unknown as { create: jest.Mock };

describe('interactionService', () => {
  const originalEnabled = process.env.INTERACTION_TRACKING_ENABLED;
  const userId = new Types.ObjectId();
  const productId = new Types.ObjectId();
  const variantId = new Types.ObjectId();
  const colorVariantId = new Types.ObjectId();
  const interactionId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERACTION_TRACKING_ENABLED = 'true';
    mockedProduct.exists.mockResolvedValue({ _id: productId });
    mockedInteraction.create.mockResolvedValue({ _id: interactionId });
  });

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env.INTERACTION_TRACKING_ENABLED;
    } else {
      process.env.INTERACTION_TRACKING_ENABLED = originalEnabled;
    }
  });

  it('persists recommendation clicks with product option fields', async () => {
    const result = await interactionService.recordInteraction({
      userId: userId.toString(),
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      actionType: 'recommendation_click',
      source: 'recommendation',
    });

    expect(mockedProduct.exists).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: productId,
        variant: {
          $elemMatch: {
            _id: variantId,
            'colors._id': colorVariantId,
          },
        },
      }),
    );
    expect(mockedInteraction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId,
        variantId,
        colorVariantId,
        size: 'M',
        actionType: 'recommendation_click',
        weight: 3,
        source: 'recommendation',
      }),
    );
    expect(result).toEqual({ recorded: true, interactionId: interactionId.toString() });
  });

  it('allows a search-result click without product attribution', async () => {
    await expect(
      interactionService.recordInteraction({
        sessionId: 'search-session',
        actionType: 'search_result_click',
        source: 'search',
      }),
    ).resolves.toMatchObject({ recorded: true });

    expect(mockedProduct.exists).not.toHaveBeenCalled();
  });

  it('requires a product for try-on interactions', async () => {
    await expect(
      interactionService.recordInteraction({
        userId: userId.toString(),
        actionType: 'try_on',
        source: 'virtual_try_on',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('can be disabled without creating a document', async () => {
    process.env.INTERACTION_TRACKING_ENABLED = 'false';

    await expect(
      interactionService.recordInteraction({
        sessionId: 'search-session',
        actionType: 'search',
        source: 'search',
      }),
    ).resolves.toEqual({ recorded: false, skippedReason: 'tracking_disabled' });

    expect(mockedInteraction.create).not.toHaveBeenCalled();
  });
});
