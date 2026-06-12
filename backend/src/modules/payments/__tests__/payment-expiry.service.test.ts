import { Types } from 'mongoose';
import { Transaction } from '../../../database/models';
import { paymentExpiryService } from '../payment-expiry.service';

jest.mock('../../../database/models', () => ({
  Transaction: {
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;

const chainLeanResult = (value: unknown) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

describe('paymentExpiryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks stale pending transactions as expired', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    const transactionId = new Types.ObjectId('665000000000000000000101');
    const orderId = new Types.ObjectId('665000000000000000000201');
    const expiredAt = new Date('2026-06-11T07:59:00.000Z');

    mockedTransaction.find.mockReturnValue(chainLeanResult([
      {
        _id: transactionId,
        order_id: orderId,
        txnRef: 'FS123A1',
        attemptNo: 1,
        expiredAt,
      },
    ]) as never);
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);

    const result = await paymentExpiryService.expireStaleTransactions(now);

    expect(mockedTransaction.find).toHaveBeenCalledWith({
      status: 'pending',
      expiredAt: { $lte: now },
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
    expect(result).toEqual({
      expiredCount: 1,
      orderIds: [orderId.toString()],
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

  it('does not update anything when no stale transaction exists', async () => {
    mockedTransaction.find.mockReturnValue(chainLeanResult([]) as never);

    const result = await paymentExpiryService.expireStaleTransactions();

    expect(mockedTransaction.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      expiredCount: 0,
      orderIds: [],
      transactions: [],
    });
  });
});
