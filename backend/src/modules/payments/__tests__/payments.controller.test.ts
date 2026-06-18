import { Types } from 'mongoose';
import { Order } from '../../../database/models';
import { transactionService } from '../transaction.service';
import { settleVNPayPayment } from '../payments.controller';

jest.mock('../../../database/models', () => ({
  Order: {
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock('../transaction.service', () => ({
  transactionService: {
    findByTxnRef: jest.fn(),
    findPendingByOrderId: jest.fn(),
    findLatestByOrderId: jest.fn(),
    findLatestAttemptByOrderId: jest.fn(),
    resolveTransaction: jest.fn(),
  },
}));

jest.mock('../payment-expiry.service', () => ({
  paymentExpiryService: {
    expireStaleTransactions: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;

const chainLeanResult = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe('settleVNPayPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails closed when VNPay callback amount is missing', async () => {
    const orderId = new Types.ObjectId('665000000000000000000201');
    const transaction = {
      _id: new Types.ObjectId('665000000000000000000301'),
      order_id: orderId,
      amount: 385000,
      status: 'pending',
    };
    const order = {
      _id: orderId,
      orderCode: 'FSORDER',
      paymentStatus: 'pending',
    };

    mockedTransactionService.findByTxnRef.mockResolvedValue(transaction as never);
    mockedOrder.findById.mockReturnValue(chainLeanResult(order) as never);

    const result = await settleVNPayPayment({
      isValidSignature: true,
      isSuccess: true,
      orderId: 'FSORDERA1',
      amount: undefined,
      responseCode: '00',
      transactionStatus: '00',
      transactionNo: 'VNP123',
      bankCode: 'NCB',
      payDate: '20260618120000',
    });

    expect(result).toMatchObject({
      rspCode: '04',
      message: 'Invalid amount',
      paymentStatus: 'pending',
    });
    expect(mockedTransactionService.resolveTransaction).not.toHaveBeenCalled();
    expect(mockedOrder.updateOne).not.toHaveBeenCalled();
  });

  it('does not let a late failed latest attempt overwrite an already paid order', async () => {
    const orderId = new Types.ObjectId('665000000000000000000202');
    const transactionId = new Types.ObjectId('665000000000000000000302');
    const transaction = {
      _id: transactionId,
      order_id: orderId,
      amount: 385000,
      status: 'pending',
    };
    const order = {
      _id: orderId,
      orderCode: 'FSORDER',
      paymentStatus: 'paid',
    };
    const resolvedTransaction = {
      ...transaction,
      status: 'failed',
    };

    mockedTransactionService.findByTxnRef.mockResolvedValue(transaction as never);
    mockedOrder.findById.mockReturnValue(chainLeanResult(order) as never);
    mockedTransactionService.resolveTransaction.mockResolvedValue(resolvedTransaction as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(resolvedTransaction as never);

    const result = await settleVNPayPayment({
      isValidSignature: true,
      isSuccess: false,
      orderId: 'FSORDERA2',
      amount: 385000,
      responseCode: '24',
      transactionStatus: '02',
      transactionNo: 'VNP124',
      bankCode: 'NCB',
      payDate: '20260618121000',
    });

    expect(mockedTransactionService.resolveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: transactionId.toString(),
        status: 'failed',
      }),
    );
    expect(mockedOrder.updateOne).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      rspCode: '00',
      transactionStatus: 'failed',
      paymentStatus: 'paid',
    });
  });
});
