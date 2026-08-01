import { Types } from 'mongoose';
import { DistributedLock, Transaction } from '../../../database/models';
import { transactionService } from '../transaction.service';

jest.mock('../../../database/models', () => ({
  DistributedLock: {
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
  Transaction: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;
const mockedDistributedLock = DistributedLock as jest.Mocked<typeof DistributedLock>;

const chainSortResult = (value: unknown) => ({
  sort: jest.fn().mockResolvedValue(value),
});

describe('transactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 0 } as never);
  });

  it('acquires and releases an order-scoped VNPay refund lock', async () => {
    const orderId = '665000000000000000000206';
    mockedDistributedLock.updateOne.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0 } as never);
    mockedDistributedLock.deleteOne.mockResolvedValue({ deletedCount: 1 } as never);

    const ownerId = await transactionService.acquireVNPayRefundLock(orderId);

    expect(ownerId).toEqual(expect.any(String));
    expect(mockedDistributedLock.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ name: `vnpay-refund:${orderId}` }),
      expect.objectContaining({
        $set: expect.objectContaining({ ownerId, expiresAt: expect.any(Date) }),
      }),
      { upsert: true },
    );

    await transactionService.releaseVNPayRefundLock(orderId, ownerId!);
    expect(mockedDistributedLock.deleteOne).toHaveBeenCalledWith({
      name: `vnpay-refund:${orderId}`,
      ownerId,
    });
  });

  it('reports a busy refund lock when another request wins the unique lock race', async () => {
    mockedDistributedLock.updateOne.mockRejectedValue({ code: 11000 });

    await expect(transactionService.acquireVNPayRefundLock('665000000000000000000207'))
      .resolves.toBeNull();
  });

  it('expires older pending VNPay attempts before creating a new attempt', async () => {
    const orderId = '665000000000000000000201';
    const createdTransaction = {
      _id: new Types.ObjectId('665000000000000000000301'),
      txnRef: 'FSORDERA2',
      attemptNo: 2,
    };

    mockedTransaction.findOne
      .mockReturnValueOnce(chainSortResult(null) as never)
      .mockReturnValueOnce(chainSortResult({ attemptNo: 1 }) as never);
    mockedTransaction.create.mockResolvedValue(createdTransaction as never);

    const result = await transactionService.ensureVNPayAttemptForOrder({
      userId: '665000000000000000000101',
      orderId,
      orderCode: 'FSORDER',
      amount: 385000,
    });

    expect(mockedTransaction.updateMany).toHaveBeenCalledWith(
      {
        order_id: new Types.ObjectId(orderId),
        status: 'pending',
      },
      {
        $set: {
          status: 'expired',
          resolvedAt: expect.any(Date),
          failureReason: 'superseded_by_new_attempt',
        },
      },
    );
    expect(mockedTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        txnRef: 'FSORDERA2',
        attemptNo: 2,
        paymentMethod: 'VNPAY',
        status: 'pending',
      }),
    );
    expect(result).toBe(createdTransaction);
  });

  it('reuses the initial pending transaction and expires other pending attempts', async () => {
    const orderId = '665000000000000000000202';
    const reusableTransaction = {
      _id: new Types.ObjectId('665000000000000000000302'),
      paymentMethodId: null,
      createdBy: 'user',
    };
    const updatedTransaction = {
      ...reusableTransaction,
      txnRef: 'FSORDERA1',
      attemptNo: 1,
    };

    mockedTransaction.findOne
      .mockReturnValueOnce(chainSortResult(reusableTransaction) as never)
      .mockReturnValueOnce(chainSortResult(null) as never);
    mockedTransaction.findOneAndUpdate.mockResolvedValue(updatedTransaction as never);

    const result = await transactionService.ensureVNPayAttemptForOrder({
      userId: '665000000000000000000101',
      orderId,
      orderCode: 'FSORDER',
      amount: 385000,
    });

    expect(mockedTransaction.updateMany).toHaveBeenCalledWith(
      {
        order_id: new Types.ObjectId(orderId),
        status: 'pending',
        _id: { $ne: reusableTransaction._id },
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'expired',
          failureReason: 'superseded_by_new_attempt',
        }),
      }),
    );
    expect(mockedTransaction.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: reusableTransaction._id, status: 'pending' },
      expect.objectContaining({
        $set: expect.objectContaining({
          txnRef: 'FSORDERA1',
          attemptNo: 1,
          gatewayProvider: 'vnpay',
        }),
      }),
      { returnDocument: 'after' },
    );
    expect(result).toBe(updatedTransaction);
  });

  it('keeps duplicate VNPay refund response 94 pending for reconciliation', async () => {
    const orderId = '665000000000000000000203';
    const createdTransaction = {
      _id: new Types.ObjectId('665000000000000000000303'),
      status: 'pending',
    };
    mockedTransaction.findOne.mockReturnValue(chainSortResult({ attemptNo: 1 }) as never);
    mockedTransaction.create.mockResolvedValue(createdTransaction as never);

    const result = await transactionService.createVNPayRefundTransaction({
      userId: '665000000000000000000101',
      orderId,
      amount: 385000,
      actorId: '665000000000000000000102',
      reason: 'Customer return approved',
      originalTxnRef: 'FSORDERA1',
      response: {
        vnp_ResponseCode: '94',
        vnp_TransactionStatus: '05',
        vnp_Command: 'refund',
      },
    });

    expect(mockedTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      failureReason: null,
      paymentDetail: expect.objectContaining({
        vnp_Command: 'refund',
        vnp_OriginalTxnRef: 'FSORDERA1',
      }),
    }));
    expect(result).toBe(createdTransaction);
  });

  it('keeps a refund pending after VNPay sends it to the bank', async () => {
    const orderId = '665000000000000000000204';
    mockedTransaction.findOne.mockReturnValue(chainSortResult({ attemptNo: 1 }) as never);
    mockedTransaction.create.mockResolvedValue({ status: 'pending' } as never);

    await transactionService.createVNPayRefundTransaction({
      userId: '665000000000000000000101',
      orderId,
      amount: 385000,
      actorId: '665000000000000000000102',
      reason: 'Customer return approved',
      originalTxnRef: 'FSORDERA1',
      response: {
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '06',
        vnp_TransactionType: '02',
      },
    });

    expect(mockedTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      resolvedAt: null,
      failureReason: null,
    }));
  });

  it('marks a rejected VNPay refund as failed instead of leaving it pending', async () => {
    const orderId = '665000000000000000000205';
    mockedTransaction.findOne.mockReturnValue(chainSortResult({ attemptNo: 1 }) as never);
    mockedTransaction.create.mockResolvedValue({ status: 'failed' } as never);

    await transactionService.createVNPayRefundTransaction({
      userId: '665000000000000000000101',
      orderId,
      amount: 385000,
      actorId: '665000000000000000000102',
      reason: 'Customer return approved',
      originalTxnRef: 'FSORDERA1',
      response: {
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '09',
        vnp_TransactionType: '02',
      },
    });

    expect(mockedTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      resolvedAt: expect.any(Date),
      failureReason: 'VNPay refund response 00 status 09',
    }));
  });
});
