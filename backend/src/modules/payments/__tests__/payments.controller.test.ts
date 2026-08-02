import type { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Order } from '../../../database/models';
import { transactionService } from '../transaction.service';
import { handleVNPayIpn, handleVNPayReturn, settleVNPayPayment } from '../payments.controller';
import * as paymentService from '../payments.service';
import { orderService } from '../../orders/order.service';

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
    recordRecommendationPaymentCompleted: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;
const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
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
    mockedOrderService.recordRecommendationPaymentCompleted.mockResolvedValue({} as never);
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
    expect(mockedOrderService.recordRecommendationPaymentCompleted).not.toHaveBeenCalled();
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
    expect(mockedOrderService.recordRecommendationPaymentCompleted).toHaveBeenCalledWith(
      orderId.toString(),
    );
    expect(result).toMatchObject({
      rspCode: '00',
      transactionStatus: 'success',
      paymentStatus: 'paid',
    });
  });

  it('records a customer-cancelled VNPay attempt as failed so the order can be retried', async () => {
    const orderId = new Types.ObjectId('665000000000000000000206');
    const transactionId = new Types.ObjectId('665000000000000000000306');
    const transaction = {
      _id: transactionId,
      order_id: orderId,
      amount: 385000,
      status: 'pending',
    };
    const order = {
      _id: orderId,
      orderCode: 'FSRETRY',
      paymentStatus: 'pending',
    };
    const resolvedTransaction = { ...transaction, status: 'failed' };

    mockedTransactionService.findByTxnRef.mockResolvedValue(transaction as never);
    mockedOrder.findById.mockReturnValue(chainLeanResult(order) as never);
    mockedTransactionService.resolveTransaction.mockResolvedValue(resolvedTransaction as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(resolvedTransaction as never);

    const result = await settleVNPayPayment({
      isValidSignature: true,
      isSuccess: false,
      orderId: 'FSRETRYA1',
      amount: 385000,
      responseCode: '24',
      transactionStatus: '02',
      transactionNo: 'VNP-RETRY-306',
      bankCode: 'NCB',
      payDate: '20260618123500',
    });

    expect(mockedTransactionService.resolveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: transactionId.toString(),
        status: 'failed',
        failureReason: 'VNPay response 24',
      }),
    );
    expect(mockedOrder.updateOne).toHaveBeenCalledWith(
      { _id: orderId, paymentStatus: { $nin: ['paid', 'refunded'] } },
      { $set: { paymentStatus: 'failed' } },
      { session: mockSession },
    );
    expect(result).toMatchObject({
      rspCode: '00',
      transactionStatus: 'failed',
      paymentStatus: 'failed',
    });
  });

  it('recovers a valid successful callback after the local attempt expired', async () => {
    const orderId = new Types.ObjectId('665000000000000000000205');
    const transactionId = new Types.ObjectId('665000000000000000000305');
    const transaction = {
      _id: transactionId,
      order_id: orderId,
      amount: 385000,
      status: 'expired',
      paymentDetail: { vnp_CreateDate: '20260618120000' },
    };
    const order = {
      _id: orderId,
      orderCode: 'FSORDER',
      paymentStatus: 'pending',
    };
    const resolvedTransaction = { ...transaction, status: 'success' };

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
      transactionNo: 'VNP127',
      bankCode: 'NCB',
      payDate: '20260618124000',
    });

    expect(mockedTransactionService.resolveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: transactionId.toString(),
        status: 'success',
        currentStatuses: ['pending', 'expired', 'failed'],
        paymentDetail: expect.objectContaining({
          vnp_CreateDate: '20260618120000',
          vnp_TransactionNo: 'VNP127',
        }),
      }),
    );
    expect(mockedOrder.updateOne).toHaveBeenCalled();
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

describe('handleVNPayReturn', () => {
  const originalCustomerFrontendUrl = process.env.CUSTOMER_FRONTEND_URL;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalMobileReturnUrl = process.env.VNPAY_MOBILE_RETURN_URL;
  const orderId = new Types.ObjectId('665000000000000000000221');
  const transactionId = new Types.ObjectId('665000000000000000000321');
  const verifiedResult = {
    isValidSignature: true,
    isSuccess: true,
    orderId: 'FSRETURNA1',
    amount: 385000,
    responseCode: '00',
    transactionStatus: '00',
    transactionNo: 'VNP-RETURN-321',
    bankCode: 'NCB',
    payDate: '20260618130000',
  };
  const transaction = {
    _id: transactionId,
    order_id: orderId,
    amount: 385000,
    status: 'success',
  };
  const order = {
    _id: orderId,
    orderCode: 'FSRETURN',
    paymentStatus: 'paid',
  };

  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  }) as unknown as Response;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(paymentService, 'verifyVNPayResponse').mockReturnValue(verifiedResult);
    mockedTransactionService.findByTxnRef.mockResolvedValue(transaction as never);
    mockedOrder.findById.mockReturnValue(chainLeanResult(order) as never);
    mockedOrderService.recordRecommendationPaymentCompleted.mockResolvedValue({} as never);
  });

  afterEach(() => {
    if (originalCustomerFrontendUrl === undefined) delete process.env.CUSTOMER_FRONTEND_URL;
    else process.env.CUSTOMER_FRONTEND_URL = originalCustomerFrontendUrl;

    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;

    if (originalMobileReturnUrl === undefined) delete process.env.VNPAY_MOBILE_RETURN_URL;
    else process.env.VNPAY_MOBILE_RETURN_URL = originalMobileReturnUrl;

    jest.restoreAllMocks();
  });

  it('returns to the web order page when the storefront URL is configured', async () => {
    process.env.CUSTOMER_FRONTEND_URL = 'http://localhost:5173';
    process.env.VNPAY_MOBILE_RETURN_URL = 'fashionapp://payment-result';
    const res = createResponse();

    await handleVNPayReturn({ query: {} } as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining(
      `http://localhost:5173/orders/${orderId.toString()}?orderId=${orderId.toString()}&paymentStatus=paid&responseCode=00&txnRef=FSRETURNA1`,
    ));
  });

  it('falls back to the mobile deep link when no storefront URL is configured', async () => {
    delete process.env.CUSTOMER_FRONTEND_URL;
    delete process.env.FRONTEND_URL;
    process.env.VNPAY_MOBILE_RETURN_URL = 'fashionapp://payment-result';
    const res = createResponse();

    await handleVNPayReturn({ query: {} } as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining(
      `fashionapp://payment-result?orderId=${orderId.toString()}&paymentStatus=paid&responseCode=00&txnRef=FSRETURNA1`,
    ));
  });
});
