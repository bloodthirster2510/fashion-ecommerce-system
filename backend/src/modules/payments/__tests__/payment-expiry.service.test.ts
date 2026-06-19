import { Types } from 'mongoose';
import { DistributedLock, Inventory, Order, Product, Transaction } from '../../../database/models';
import { inventoryService } from '../../inventory/inventory.service';
import { couponService } from '../../promotions/coupons/coupon.service';
import { paymentExpiryService } from '../payment-expiry.service';

jest.mock('../../../database/models', () => ({
  Inventory: {
    updateOne: jest.fn(),
  },
  DistributedLock: {
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
  Order: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Product: {
    updateOne: jest.fn(),
  },
  Transaction: {
    find: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.mock('../../inventory/inventory.service', () => ({
  inventoryService: {
    restoreImportRemainingQuantities: jest.fn(),
  },
}));

jest.mock('../../promotions/coupons/coupon.service', () => ({
  couponService: {
    rollbackRecordedCouponUsage: jest.fn(),
    rollbackCouponUsageReservation: jest.fn(),
  },
}));

const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedDistributedLock = DistributedLock as jest.Mocked<typeof DistributedLock>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;
const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;
const mockedCouponService = couponService as jest.Mocked<typeof couponService>;

const chainLeanResult = (value: unknown) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

const chainSortLeanResult = (value: unknown) => ({
  sort: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

describe('paymentExpiryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedOrder.findOne.mockResolvedValue(null as never);
    mockedOrder.findOneAndUpdate.mockResolvedValue(null as never);
    mockedTransaction.findOne.mockReturnValue(chainSortLeanResult(null) as never);
    mockedDistributedLock.updateOne.mockResolvedValue({ modifiedCount: 1, upsertedCount: 0 } as never);
    mockedDistributedLock.deleteOne.mockResolvedValue({} as never);
    mockedInventoryService.restoreImportRemainingQuantities.mockResolvedValue(undefined);
    mockedCouponService.rollbackRecordedCouponUsage.mockResolvedValue(undefined);
    mockedCouponService.rollbackCouponUsageReservation.mockResolvedValue(undefined);
  });

  it('marks stale pending transactions as expired and cancels confirmed unpaid online orders when latest attempt expires', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    const transactionId = new Types.ObjectId('665000000000000000000101');
    const orderId = new Types.ObjectId('665000000000000000000201');
    const userId = new Types.ObjectId('665000000000000000000202');
    const couponId = new Types.ObjectId('665000000000000000000203');
    const productId = new Types.ObjectId('665000000000000000000301');
    const variantId = new Types.ObjectId('665000000000000000000302');
    const colorVariantId = new Types.ObjectId('665000000000000000000303');
    const expiredAt = new Date('2026-06-11T07:54:00.000Z');
    const order = {
      _id: orderId,
      user_id: userId,
      couponId,
      order_list: [
        {
          productId,
          variantId,
          colorVariantId,
          size: 'M',
          quantity: 2,
        },
      ],
      status: 'confirmed',
      paymentStatus: 'pending',
    };

    mockedTransaction.find.mockReturnValue(chainLeanResult([
      {
        _id: transactionId,
        order_id: orderId,
        txnRef: 'FS123A1',
        attemptNo: 1,
        expiredAt,
      },
    ]) as never);
    mockedTransaction.findOne.mockReturnValue(chainSortLeanResult({
      _id: transactionId,
      order_id: orderId,
      status: 'expired',
    }) as never);
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedOrder.findOneAndUpdate.mockResolvedValue({
      ...order,
      status: 'cancelled',
      paymentStatus: 'failed',
    } as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);

    const result = await paymentExpiryService.expireStaleTransactions(now);

    expect(mockedTransaction.find).toHaveBeenCalledWith({
      status: 'pending',
      expiredAt: { $lte: new Date('2026-06-11T07:55:00.000Z') },
    });
    expect(mockedTransaction.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [transactionId] },
        status: 'pending',
      },
      {
        $set: {
          status: 'expired',
          resolvedAt: now,
          failureReason: 'expired',
        },
      },
    );
    expect(mockedOrder.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: orderId,
        status: 'confirmed',
        paymentMethod: { $in: ['VNPAY', 'MOMO', 'CARD', 'BANK'] },
        paymentStatus: { $in: ['pending', 'failed'] },
      },
      {
        $set: {
          status: 'cancelled',
          paymentStatus: 'failed',
        },
      },
      {
        returnDocument: 'after',
      },
    );
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
    expect(mockedInventoryService.restoreImportRemainingQuantities).toHaveBeenCalledWith([
      {
        productId,
        variantId,
        colorVariantId,
        size: 'M',
        quantity: 2,
      },
    ]);
    expect(mockedCouponService.rollbackRecordedCouponUsage).toHaveBeenCalledWith(orderId.toString());
    expect(mockedCouponService.rollbackCouponUsageReservation).toHaveBeenCalledWith(
      couponId.toString(),
      userId.toString(),
    );
    expect(result).toEqual({
      expiredCount: 1,
      orderIds: [orderId.toString()],
      cancelledOrderIds: [orderId.toString()],
      transactions: [
        {
          id: transactionId.toString(),
          orderId: orderId.toString(),
          txnRef: 'FS123A1',
          attemptNo: 1,
          expiredAt,
        },
      ],
    });
  });

  it('does not cancel an order when an older attempt expires but a newer attempt exists', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    const transactionId = new Types.ObjectId('665000000000000000000102');
    const latestTransactionId = new Types.ObjectId('665000000000000000000103');
    const orderId = new Types.ObjectId('665000000000000000000202');

    mockedTransaction.find.mockReturnValue(chainLeanResult([
      {
        _id: transactionId,
        order_id: orderId,
        txnRef: 'FS123A1',
        attemptNo: 1,
        expiredAt: new Date('2026-06-11T07:54:00.000Z'),
      },
    ]) as never);
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedTransaction.findOne.mockReturnValue(chainSortLeanResult({
      _id: latestTransactionId,
      order_id: orderId,
      status: 'pending',
    }) as never);

    const result = await paymentExpiryService.expireStaleTransactions(now);

    expect(mockedOrder.findOneAndUpdate).not.toHaveBeenCalled();
    expect(result.cancelledOrderIds).toEqual([]);
  });

  it('does not restock when another worker already claimed the expired order', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    const transactionId = new Types.ObjectId('665000000000000000000104');
    const orderId = new Types.ObjectId('665000000000000000000204');

    mockedTransaction.find.mockReturnValue(chainLeanResult([
      {
        _id: transactionId,
        order_id: orderId,
        txnRef: 'FS123A1',
        attemptNo: 1,
        expiredAt: new Date('2026-06-11T07:54:00.000Z'),
      },
    ]) as never);
    mockedTransaction.findOne.mockReturnValue(chainSortLeanResult({
      _id: transactionId,
      order_id: orderId,
      status: 'expired',
    }) as never);
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedOrder.findOneAndUpdate.mockResolvedValue(null as never);

    const result = await paymentExpiryService.expireStaleTransactions(now);

    expect(mockedOrder.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: orderId,
        status: 'confirmed',
      }),
      expect.any(Object),
      expect.any(Object),
    );
    expect(mockedInventory.updateOne).not.toHaveBeenCalled();
    expect(mockedProduct.updateOne).not.toHaveBeenCalled();
    expect(mockedInventoryService.restoreImportRemainingQuantities).not.toHaveBeenCalled();
    expect(result.cancelledOrderIds).toEqual([]);
  });

  it('does not update anything when no stale transaction exists', async () => {
    mockedTransaction.find.mockReturnValue(chainLeanResult([]) as never);

    const result = await paymentExpiryService.expireStaleTransactions();

    expect(mockedTransaction.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredCount: 0,
      orderIds: [],
      cancelledOrderIds: [],
      transactions: [],
    });
  });

  it('skips expiry when another instance owns the distributed lock', async () => {
    const duplicateKeyError = Object.assign(new Error('duplicate lock'), { code: 11000 });
    mockedDistributedLock.updateOne.mockRejectedValue(duplicateKeyError);

    const result = await paymentExpiryService.expireStaleTransactionsWithLock(
      new Date('2026-06-11T08:00:00.000Z'),
    );

    expect(mockedTransaction.find).not.toHaveBeenCalled();
    expect(mockedDistributedLock.deleteOne).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredCount: 0,
      orderIds: [],
      cancelledOrderIds: [],
      transactions: [],
      lockSkipped: true,
    });
  });

  it('releases the distributed lock after expiry completes', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    mockedTransaction.find.mockReturnValue(chainLeanResult([]) as never);

    const result = await paymentExpiryService.expireStaleTransactionsWithLock(now);

    expect(mockedDistributedLock.updateOne).toHaveBeenCalledWith(
      {
        name: 'payment-expiry',
        $or: [
          { expiresAt: { $lte: now } },
          { ownerId: expect.any(String) },
        ],
      },
      {
        $set: {
          ownerId: expect.any(String),
          expiresAt: new Date('2026-06-11T08:05:00.000Z'),
        },
        $setOnInsert: {
          name: 'payment-expiry',
        },
      },
      { upsert: true },
    );
    expect(mockedDistributedLock.deleteOne).toHaveBeenCalledWith({
      name: 'payment-expiry',
      ownerId: expect.any(String),
    });
    expect(result).toEqual({
      expiredCount: 0,
      orderIds: [],
      cancelledOrderIds: [],
      transactions: [],
    });
  });
});
