import { Types } from 'mongoose';
import { Cart, Inventory, Product } from '../../../database/models';
import { cartService } from '../cart.service';
import { resolveSaleItem } from '../../sales/sales.helpers';
import { recommendationService } from '../../recommendations/recommendation.service';

jest.mock('../../../database/models', () => ({
  Cart: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Inventory: {
    find: jest.fn(),
  },
  Product: {
    find: jest.fn(),
  },
}));

jest.mock('../../sales/sales.helpers', () => {
  const actual = jest.requireActual('../../sales/sales.helpers');

  return {
    ...actual,
    resolveSaleItem: jest.fn(),
  };
});

jest.mock('../../recommendations/recommendation.service', () => ({
  recommendationService: {
    recordRecommendationConversionEventBestEffort: jest.fn(),
  },
}));

jest.mock('../../interactions/interaction.service', () => ({
  interactionService: {
    recordAddToCartBestEffort: jest.fn(),
  },
}));

const mockedCart = Cart as jest.Mocked<typeof Cart>;
const mockedInventory = Inventory as unknown as { find: jest.Mock };
const mockedProduct = Product as unknown as { find: jest.Mock };
const mockedResolveSaleItem = resolveSaleItem as jest.MockedFunction<typeof resolveSaleItem>;
const mockedRecommendationService = recommendationService as jest.Mocked<typeof recommendationService>;

const userId = '665000000000000000000020';
const productId = new Types.ObjectId('665000000000000000000003');
const variantId = new Types.ObjectId('665000000000000000000011');
const colorVariantId = new Types.ObjectId('665000000000000000000012');
const colorImage = 'https://example.com/black.png';

const mockAvailableCartLookups = (availableQuantity = 10) => {
  mockedProduct.find.mockReturnValue({
    populate: jest.fn().mockResolvedValue([
      {
        _id: productId,
        name: 'Basic Tee',
        isActive: true,
        product_image: colorImage,
        brand_id: { _id: new Types.ObjectId(), name: 'Fashionista' },
        variant: [
          {
            _id: variantId,
            isActive: true,
            price: 200000,
            discount: 10,
            colors: [{ _id: colorVariantId, color: 'Black', colorCode: '#000000', image: colorImage }],
          },
        ],
      },
    ]),
  });
  mockedInventory.find.mockResolvedValue([
    {
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      availableQuantity,
    },
  ]);
};

describe('cartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInventory.find.mockResolvedValue([]);
    mockedProduct.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
  });

  it('adds an unselected cart item using server-resolved sku and price by default', async () => {
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(null);
    mockedCart.create.mockResolvedValue(cart as never);
    mockAvailableCartLookups();
    mockedResolveSaleItem.mockResolvedValue({
      product: { name: 'Basic Tee' },
      variant: {},
      color: { color: 'Black' },
      inventory: { availableQuantity: 10 },
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      finalPrice: 180000,
      fitType: 'Regular',
      image: colorImage,
    } as never);

    const result = await cartService.addCartItem(userId, {
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      quantity: 2,
    });

    expect(mockedResolveSaleItem).toHaveBeenCalledWith(
      productId.toString(),
      variantId.toString(),
      colorVariantId.toString(),
      'M',
      2,
    );
    expect(cart.product_list).toHaveLength(1);
    expect(cart.product_list[0]).toMatchObject({
      sku: 'INV-TEE-BLK-M',
      quantity: 2,
      priceAtAddedTime: 180000,
      isSelected: false,
    });
    expect(cart.save).toHaveBeenCalled();
    expect(result.summary.subTotal).toBe(0);
  });

  it('adds a selected cart item when explicitly requested', async () => {
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(null);
    mockedCart.create.mockResolvedValue(cart as never);
    mockAvailableCartLookups();
    mockedResolveSaleItem.mockResolvedValue({
      product: { name: 'Basic Tee' },
      variant: {},
      color: { color: 'Black' },
      inventory: { availableQuantity: 10 },
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      finalPrice: 180000,
      fitType: 'Regular',
      image: colorImage,
    } as never);

    const result = await cartService.addCartItem(userId, {
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      quantity: 2,
      isSelected: true,
    });

    expect(cart.product_list[0]).toMatchObject({
      quantity: 2,
      isSelected: true,
    });
    expect(result.summary.subTotal).toBe(360000);
  });

  it('records recommendation add-to-cart conversion when request id is present', async () => {
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(null);
    mockedCart.create.mockResolvedValue(cart as never);
    mockedResolveSaleItem.mockResolvedValue({
      product: { name: 'Basic Tee' },
      variant: {},
      color: { color: 'Black' },
      inventory: { availableQuantity: 10 },
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      finalPrice: 180000,
      fitType: 'Regular',
      image: 'https://example.com/black.png',
    } as never);

    await cartService.addCartItem(userId, {
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      quantity: 1,
      recommendationRequestId: 'rec_123',
    });

    expect(mockedRecommendationService.recordRecommendationConversionEventBestEffort).toHaveBeenCalledWith({
      userId,
      requestId: 'rec_123',
      recommendedProductId: productId.toString(),
      eventType: 'add_to_cart',
    });
  });

  it('rejects adding more of an existing item than available inventory', async () => {
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [
        {
          _id: new Types.ObjectId(),
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          sku: 'INV-TEE-BLK-M',
          quantity: 9,
          priceAtAddedTime: 180000,
          isSelected: true,
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(cart as never);
    mockedResolveSaleItem.mockResolvedValue({
      product: { name: 'Basic Tee' },
      variant: {},
      color: { color: 'Black' },
      inventory: { availableQuantity: 10 },
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      finalPrice: 180000,
      fitType: 'Regular',
      image: 'https://example.com/black.png',
    } as never);

    await expect(
      cartService.addCartItem(userId, {
        productId: productId.toString(),
        variantId: variantId.toString(),
        colorVariantId: colorVariantId.toString(),
        size: 'M',
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      message: 'Không đủ hàng.',
      statusCode: 409,
    });

    expect(cart.product_list[0].quantity).toBe(9);
    expect(cart.save).not.toHaveBeenCalled();
  });

  it('can replace an existing item quantity instead of incrementing it', async () => {
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [
        {
          _id: new Types.ObjectId(),
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          sku: 'INV-TEE-BLK-M',
          quantity: 3,
          priceAtAddedTime: 180000,
          isSelected: false,
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(cart as never);
    mockAvailableCartLookups();
    mockedResolveSaleItem.mockResolvedValue({
      product: { name: 'Basic Tee' },
      variant: {},
      color: { color: 'Black' },
      inventory: { availableQuantity: 10 },
      productId,
      variantId,
      colorVariantId,
      size: 'M',
      sku: 'INV-TEE-BLK-M',
      finalPrice: 180000,
      fitType: 'Regular',
      image: colorImage,
    } as never);

    const result = await cartService.addCartItem(userId, {
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      quantity: 1,
      isSelected: true,
      replaceQuantity: true,
    });

    expect(cart.product_list[0]).toMatchObject({
      quantity: 1,
      isSelected: true,
    });
    expect(cart.save).toHaveBeenCalled();
    expect(result.summary.selectedItemCount).toBe(1);
    expect(result.summary.subTotal).toBe(180000);
  });

  it('selects an available cart item', async () => {
    const itemId = new Types.ObjectId();
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [
        {
          _id: itemId,
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          sku: 'INV-TEE-BLK-M',
          quantity: 2,
          priceAtAddedTime: 180000,
          isSelected: false,
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(cart as never);
    mockAvailableCartLookups();

    const result = await cartService.selectCartItem(userId, itemId.toString(), { isSelected: true });

    expect(cart.product_list[0].isSelected).toBe(true);
    expect(cart.save).toHaveBeenCalled();
    expect(result.summary.selectedItemCount).toBe(2);
    expect(result.summary.subTotal).toBe(360000);
  });

  it('does not select a cart item when inventory is insufficient', async () => {
    const itemId = new Types.ObjectId();
    const cart = {
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(userId),
      product_list: [
        {
          _id: itemId,
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          sku: 'INV-TEE-BLK-M',
          quantity: 2,
          priceAtAddedTime: 180000,
          isSelected: false,
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedCart.findOne.mockResolvedValue(cart as never);
    mockAvailableCartLookups(1);

    const result = await cartService.selectCartItem(userId, itemId.toString(), { isSelected: true });

    expect(cart.product_list[0].isSelected).toBe(false);
    expect(cart.save).toHaveBeenCalled();
    expect(result.product_list[0].isSelected).toBe(false);
    expect(result.product_list[0].isAvailable).toBe(false);
    expect(result.summary.selectedItemCount).toBe(0);
    expect(result.summary.subTotal).toBe(0);
  });
});
