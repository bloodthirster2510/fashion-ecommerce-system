import { Types } from 'mongoose';
import { DistributedLock, Transaction } from '../../../database/models';
import { paymentExpiryService } from '../payment-expiry.service';

jest.mock('../../../database/models', () => ({
  DistributedLock: { updateOne: jest.fn(), deleteOne: jest.fn() },
  Transaction: { find: jest.fn(), updateMany: jest.fn() },
}));

const mockedLock = DistributedLock as jest.Mocked<typeof DistributedLock>;
const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;
const chainLeanResult = (value: unknown) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

describe('paymentExpiryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLock.updateOne.mockResolvedValue({ modifiedCount: 1, upsertedCount: 0 } as never);
    mockedLock.deleteOne.mockResolvedValue({} as never);
  });

  it('expires stale payment links without cancelling their orders', async () => {
    const now = new Date('2026-06-11T08:00:00.000Z');
    const transactionId = new Types.ObjectId('665000000000000000000101');
    const orderId = new Types.ObjectId('665000000000000000000201');
    const expiredAt = new Date('2026-06-11T07:54:00.000Z');
    mockedTransaction.find.mockReturnValue(chainLeanResult([{
      _id: transactionId,
      order_id: orderId,
      txnRef: 'FS123A1',
      attemptNo: 1,
      expiredAt,
    }]) as never);
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);

    const result = await paymentExpiryService.expireStaleTransactions(now);

    expect(mockedTransaction.find).toHaveBeenCalledWith({
      status: 'pending',
      expiredAt: { $lte: new Date('2026-06-11T07:55:00.000Z') },
    });
    expect(mockedTransaction.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [transactionId] }, status: 'pending' },
      { $set: { status: 'expired', resolvedAt: now, failureReason: 'expired' } },
    );
    expect(result.cancelledOrderIds).toEqual([]);
    expect(result.expiredCount).toBe(1);
    expect(result.orderIds).toEqual([orderId.toString()]);
  });

  it('does nothing when no payment link is stale', async () => {
    mockedTransaction.find.mockReturnValue(chainLeanResult([]) as never);
    await expect(paymentExpiryService.expireStaleTransactions()).resolves.toEqual({
      expiredCount: 0,
      orderIds: [],
      cancelledOrderIds: [],
      transactions: [],
    });
    expect(mockedTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('skips work when another instance owns the lock', async () => {
    mockedLock.updateOne.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    await expect(paymentExpiryService.expireStaleTransactionsWithLock()).resolves.toMatchObject({
      expiredCount: 0,
      lockSkipped: true,
    });
    expect(mockedTransaction.find).not.toHaveBeenCalled();
  });

  it('releases its distributed lock', async () => {
    mockedTransaction.find.mockReturnValue(chainLeanResult([]) as never);
    await paymentExpiryService.expireStaleTransactionsWithLock(new Date('2026-06-11T08:00:00.000Z'));
    expect(mockedLock.deleteOne).toHaveBeenCalledWith({
      name: 'payment-expiry',
      ownerId: expect.any(String),
    });
  });
});
