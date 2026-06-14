import { Types } from 'mongoose';
import { Inventory, Order, Product, Transaction } from '../../../database/models';
import { paymentExpiryService } from '../payment-expiry.service';

jest.mock('../../../database/models', () => ({
  Inventory: {
    updateOne: jest.fn(),
  },
  Order: {
    findOne: jest.fn(),
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

const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;

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
    mockedTransaction.findOne.mockReturnValue(chainSortLeanResult(null) as never);
  });

  it('marks stale pending transactions as expired and cancels confirmed unpaid online orders when latest attempt expires', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    const transactionId = new Types.ObjectId('665000000000000000000101');
    const orderId = new Types.ObjectId('665000000000000000000201');
    const productId = new Types.ObjectId('665000000000000000000301');
    const variantId = new Types.ObjectId('665000000000000000000302');
    const colorVariantId = new Types.ObjectId('665000000000000000000303');
    const expiredAt = new Date('2026-06-11T07:54:00.000Z');
    const order = {
      _id: orderId,
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
      save: jest.fn(),
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
    mockedOrder.findOne.mockResolvedValue(order as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedProduct.updateOne.mockResolvedValue({} as never);
    order.save.mockResolvedValue(order as never);

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
    expect(mockedOrder.findOne).toHaveBeenCalledWith({
      _id: orderId,
      status: 'confirmed',
      paymentMethod: { $in: ['VNPAY', 'MOMO', 'CARD', 'BANK'] },
      paymentStatus: { $in: ['pending', 'failed'] },
    });
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
    expect(order.paymentStatus).toBe('failed');
    expect(order.save).toHaveBeenCalled();
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

    expect(mockedOrder.findOne).not.toHaveBeenCalled();
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
});
