import { Types } from 'mongoose';
import { Cart, Inventory, Order, Product } from '../../../database/models';
import { inventoryService } from '../../inventory/inventory.service';
import { cartService } from '../../cart/cart.service';
import { resolveSaleItem } from '../../sales/sales.helpers';
import { orderService } from '../order.service';

jest.mock('../../../database/models', () => ({
  Cart: {
    findOne: jest.fn(),
  },
  Order: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Product: {
    updateOne: jest.fn(),
  },
  Inventory: {
    updateOne: jest.fn(),
  },
}));

jest.mock('../../inventory/inventory.service', () => ({
  inventoryService: {
    reserveInventory: jest.fn(),
    commitReservations: jest.fn(),
    releaseReservations: jest.fn(),
  },
}));

jest.mock('../../cart/cart.service', () => ({
  cartService: {
    deleteCartItems: jest.fn(),
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
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;
const mockedCartService = cartService as jest.Mocked<typeof cartService>;
const mockedResolveSaleItem = resolveSaleItem as jest.MockedFunction<typeof resolveSaleItem>;

const userId = '665000000000000000000020';
const productId = new Types.ObjectId('665000000000000000000003');
const variantId = new Types.ObjectId('665000000000000000000011');
const colorVariantId = new Types.ObjectId('665000000000000000000012');
const cartItemId = new Types.ObjectId('665000000000000000000030');
const reservationId = new Types.ObjectId('665000000000000000000040');

describe('orderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a COD order by reserving and committing inventory', async () => {
    const cart = {
      user_id: new Types.ObjectId(userId),
      product_list: [
        {
          _id: cartItemId,
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          sku: 'OLD-SKU',
          quantity: 2,
          priceAtAddedTime: 199000,
          isSelected: true,
        },
      ],
    };
    const order = {
      _id: new Types.ObjectId(),
      orderCode: 'FSORDER',
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'confirmed',
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
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedInventoryService.commitReservations.mockResolvedValue([] as never);
    mockedOrder.create.mockResolvedValue(order as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    mockedCartService.deleteCartItems.mockResolvedValue({} as never);

    const result = await orderService.createOrder(userId, {
      cartItemIds: [cartItemId.toString()],
      paymentMethod: 'COD',
      shippingAddress: {
        customerName: 'Nguyen Van A',
        province: 'Can Tho',
        district: 'Ninh Kieu',
        ward: 'An Khanh',
        streetName: '123 Duong 3/2',
        phoneNumber: '0912345678',
      },
    });

    expect(mockedInventoryService.reserveInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        items: [
          {
            productId: productId.toString(),
            variantId: variantId.toString(),
            colorVariantId: colorVariantId.toString(),
            size: 'M',
            quantity: 2,
          },
        ],
      }),
    );
    expect(mockedOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: expect.any(Types.ObjectId),
        subTotal: 360000,
        shippingFee: 25000,
        totalAmount: 385000,
        status: 'confirmed',
        paymentMethod: 'COD',
        paymentStatus: 'pending',
      }),
    );
    expect(mockedInventoryService.commitReservations).toHaveBeenCalledWith({
      reservationIds: [reservationId.toString()],
    });
    expect(mockedCartService.deleteCartItems).toHaveBeenCalledWith(userId, [cartItemId.toString()]);
    expect(result).toBe(order);
  });

  it('releases reservations when order creation fails after inventory is reserved', async () => {
    const cart = {
      user_id: new Types.ObjectId(userId),
      product_list: [
        {
          _id: cartItemId,
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          sku: 'OLD-SKU',
          quantity: 2,
          priceAtAddedTime: 199000,
          isSelected: true,
        },
      ],
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
    mockedInventoryService.reserveInventory.mockResolvedValue([
      { _id: reservationId },
    ] as never);
    mockedOrder.create.mockRejectedValue(new Error('create failed'));
    mockedInventoryService.releaseReservations.mockResolvedValue([] as never);

    await expect(
      orderService.createOrder(userId, {
        cartItemIds: [cartItemId.toString()],
        paymentMethod: 'COD',
        shippingAddress: {
          customerName: 'Nguyen Van A',
          province: 'Can Tho',
          district: 'Ninh Kieu',
          ward: 'An Khanh',
          streetName: '123 Duong 3/2',
          phoneNumber: '0912345678',
        },
      }),
    ).rejects.toThrow('create failed');

    expect(mockedInventoryService.releaseReservations).toHaveBeenCalledWith({
      reservationIds: [reservationId.toString()],
    });
    expect(mockedCartService.deleteCartItems).not.toHaveBeenCalled();
  });

  it('restocks inventory and refunds paid COD orders when cancelled', async () => {
    const orderId = new Types.ObjectId('665000000000000000000050');
    const order = {
      _id: orderId,
      user_id: new Types.ObjectId(userId),
      status: 'confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'paid',
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 2,
        },
      ],
      save: jest.fn(),
    };
    order.save.mockResolvedValue(order as never);
    mockedOrder.findById.mockResolvedValue(order as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);

    const result = await orderService.cancelOrder(userId, undefined, orderId.toString());

    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
      },
      {
        $inc: {
          quantity: 2,
          availableQuantity: 2,
        },
      },
    );
    expect(mockedProduct.updateOne).toHaveBeenCalledWith(
      { _id: productId, sold_quantity: { $gte: 2 } },
      { $inc: { sold_quantity: -2 } },
    );
    expect(order.status).toBe('cancelled');
    expect(order.paymentStatus).toBe('refunded');
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
  });
});
