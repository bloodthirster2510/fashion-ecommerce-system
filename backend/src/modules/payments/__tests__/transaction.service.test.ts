import { Types } from 'mongoose';
import { Transaction } from '../../../database/models';
import { transactionService } from '../transaction.service';

jest.mock('../../../database/models', () => ({
  Transaction: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;

const chainSortResult = (value: unknown) => ({
  sort: jest.fn().mockResolvedValue(value),
});

describe('transactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 0 } as never);
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
