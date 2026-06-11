import { Types } from 'mongoose';
import { Cart, Inventory, Product } from '../../../database/models';
import { cartService } from '../cart.service';
import { resolveSaleItem } from '../../sales/sales.helpers';

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

const mockedCart = Cart as jest.Mocked<typeof Cart>;
const mockedInventory = Inventory as unknown as { find: jest.Mock };
const mockedProduct = Product as unknown as { find: jest.Mock };
const mockedResolveSaleItem = resolveSaleItem as jest.MockedFunction<typeof resolveSaleItem>;

const userId = '665000000000000000000020';
const productId = new Types.ObjectId('665000000000000000000003');
const variantId = new Types.ObjectId('665000000000000000000011');
const colorVariantId = new Types.ObjectId('665000000000000000000012');

describe('cartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInventory.find.mockResolvedValue([]);
    mockedProduct.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
  });

  it('adds a cart item using server-resolved sku and price', async () => {
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
      isSelected: true,
    });
    expect(cart.save).toHaveBeenCalled();
    expect(result.summary.subTotal).toBe(360000);
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
      message: 'Insufficient available inventory',
      statusCode: 409,
    });

    expect(cart.product_list[0].quantity).toBe(9);
    expect(cart.save).not.toHaveBeenCalled();
  });
});
