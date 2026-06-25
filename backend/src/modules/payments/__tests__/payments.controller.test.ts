import type { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Order } from '../../../database/models';
import { transactionService } from '../transaction.service';
import { handleVNPayIpn, settleVNPayPayment } from '../payments.controller';

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
    expireStaleTransactionsWithLock: jest.fn(),
  },
}));

jest.mock('../../orders/order.service', () => ({
  orderService: {
    getOrderById: jest.fn(),
    adjustOrderPaymentStatus: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;
const startSessionSpy = jest.spyOn(mongoose, 'startSession');

type MockSession = {
  withTransaction: jest.Mock;
  endSession: jest.Mock;
};

let mockSession: MockSession;

const chainLeanResult = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe('settleVNPayPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = {
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: jest.fn(),
    };
    startSessionSpy.mockResolvedValue(mockSession as never);
    mockedOrder.updateOne.mockResolvedValue({ matchedCount: 1 } as never);
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
    expect(startSessionSpy).not.toHaveBeenCalled();
  });

  it('resolves a successful payment and updates the order in one Mongo session', async () => {
    const orderId = new Types.ObjectId('665000000000000000000204');
    const transactionId = new Types.ObjectId('665000000000000000000304');
    const transaction = {
      _id: transactionId,
      order_id: orderId,
      amount: 385000,
      status: 'pending',
    };
    const order = {
      _id: orderId,
      orderCode: 'FSORDER',
      paymentStatus: 'pending',
    };
    const resolvedTransaction = {
      ...transaction,
      status: 'success',
    };

    mockedTransactionService.findByTxnRef.mockResolvedValue(transaction as never);
    mockedOrder.findById.mockReturnValue(chainLeanResult(order) as never);
    mockedTransactionService.resolveTransaction.mockResolvedValue(resolvedTransaction as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(resolvedTransaction as never);

    const result = await settleVNPayPayment({
      isValidSignature: true,
      isSuccess: true,
      orderId: 'FSORDERA1',
      amount: 385000,
      responseCode: '00',
      transactionStatus: '00',
      transactionNo: 'VNP126',
      bankCode: 'NCB',
      payDate: '20260618123000',
    });

    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockedTransactionService.resolveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: transactionId.toString(),
        status: 'success',
        session: mockSession,
      }),
    );
    expect(mockedTransactionService.findLatestAttemptByOrderId).toHaveBeenCalledWith(
      orderId.toString(),
      mockSession,
    );
    expect(mockedOrder.updateOne).toHaveBeenCalledWith(
      { _id: orderId, paymentStatus: { $nin: ['paid', 'refunded'] } },
      { $set: { paymentStatus: 'paid' } },
      { session: mockSession },
    );
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      rspCode: '00',
      transactionStatus: 'success',
      paymentStatus: 'paid',
    });
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

  it('does not let a late successful attempt reopen an already refunded order', async () => {
    const orderId = new Types.ObjectId('665000000000000000000203');
    const transactionId = new Types.ObjectId('665000000000000000000303');
    const transaction = {
      _id: transactionId,
      order_id: orderId,
      amount: 385000,
      status: 'pending',
    };
    const order = {
      _id: orderId,
      orderCode: 'FSORDER',
      paymentStatus: 'refunded',
    };
    const resolvedTransaction = {
      ...transaction,
      status: 'success',
    };

    mockedTransactionService.findByTxnRef.mockResolvedValue(transaction as never);
    mockedOrder.findById.mockReturnValue(chainLeanResult(order) as never);
    mockedTransactionService.resolveTransaction.mockResolvedValue(resolvedTransaction as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(resolvedTransaction as never);

    const result = await settleVNPayPayment({
      isValidSignature: true,
      isSuccess: true,
      orderId: 'FSORDERA3',
      amount: 385000,
      responseCode: '00',
      transactionStatus: '00',
      transactionNo: 'VNP125',
      bankCode: 'NCB',
      payDate: '20260618122000',
    });

    expect(mockedTransactionService.resolveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: transactionId.toString(),
        status: 'success',
      }),
    );
    expect(mockedOrder.updateOne).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      rspCode: '00',
      transactionStatus: 'success',
      paymentStatus: 'refunded',
    });
  });
});

describe('handleVNPayIpn', () => {
  const originalVNPayHashSecret = process.env.VNPAY_HASH_SECRET;

  afterEach(() => {
    if (originalVNPayHashSecret === undefined) {
      delete process.env.VNPAY_HASH_SECRET;
    } else {
      process.env.VNPAY_HASH_SECRET = originalVNPayHashSecret;
    }
    jest.restoreAllMocks();
  });

  it('returns a generic message when VNPay verification throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.VNPAY_HASH_SECRET;
    const req = { query: {} } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await handleVNPayIpn(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      RspCode: '99',
      Message: 'Internal Server Error',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to handle VNPay IPN:', expect.any(Error));
  });
});
