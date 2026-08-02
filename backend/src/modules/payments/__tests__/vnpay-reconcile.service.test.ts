import { Types } from 'mongoose';
import { Order, Transaction } from '../../../database/models';
import { orderService } from '../../orders/order.service';
import { settleVNPayPayment } from '../payments.controller';
import { queryVNPayTransaction } from '../payments.service';
import { transactionService } from '../transaction.service';
import { vnpayReconcileService } from '../vnpay-reconcile.service';

jest.mock('../../../database/models', () => ({
  DistributedLock: {
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
  Order: {
    findById: jest.fn(),
  },
  Transaction: {
    find: jest.fn(),
  },
}));

jest.mock('../payments.service', () => ({
  getVNPayServerIp: jest.fn(() => '127.0.0.1'),
  queryVNPayTransaction: jest.fn(),
}));

jest.mock('../payments.controller', () => ({
  settleVNPayPayment: jest.fn(),
}));

jest.mock('../transaction.service', () => ({
  transactionService: {
    findLatestAttemptByOrderId: jest.fn(),
    findLatestSuccessfulByOrderId: jest.fn(),
    findLatestVNPayRefundByOrderId: jest.fn(),
    recordVNPayQueryResult: jest.fn(),
    resolveVNPayRefundTransaction: jest.fn(),
  },
}));

jest.mock('../../orders/order.service', () => ({
  orderService: {
    markVNPayRefundCompleted: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;
const mockedQuery = queryVNPayTransaction as jest.MockedFunction<typeof queryVNPayTransaction>;
const mockedSettle = settleVNPayPayment as jest.MockedFunction<typeof settleVNPayPayment>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;
const mockedOrderService = orderService as jest.Mocked<typeof orderService>;

const leanResult = (value: unknown) => ({ lean: jest.fn().mockResolvedValue(value) });

describe('vnpayReconcileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles a successful payment discovered by QueryDr after local expiry', async () => {
    const orderId = new Types.ObjectId('665000000000000000000501');
    const transaction = {
      _id: new Types.ObjectId('665000000000000000000601'),
      order_id: orderId,
      txnRef: 'FSORDERA1',
      amount: 385000,
      status: 'expired',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
      gatewayTransactionId: null,
    };
    mockedOrder.findById.mockReturnValue(leanResult({
      _id: orderId,
      paymentMethod: 'VNPAY',
      paymentStatus: 'pending',
      totalAmount: 385000,
    }) as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(transaction as never);
    mockedQuery.mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '01',
      vnp_TxnRef: 'FSORDERA1',
      vnp_Amount: '38500000',
      vnp_TransactionNo: '123456',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20260618120500',
    });
    mockedSettle.mockResolvedValue({ rspCode: '00', message: 'Confirm success', paymentStatus: 'paid' });

    const result = await vnpayReconcileService.reconcileOrder(orderId.toString());

    expect(mockedQuery).toHaveBeenCalledWith(expect.objectContaining({
      txnRef: 'FSORDERA1',
      transactionDate: '20260618120000',
    }));
    expect(mockedTransactionService.recordVNPayQueryResult).toHaveBeenCalled();
    expect(mockedSettle).toHaveBeenCalledWith(expect.objectContaining({
      isValidSignature: true,
      isSuccess: true,
      amount: 385000,
    }));
    expect(result.settlement?.paymentStatus).toBe('paid');
  });

  it('treats an unsigned duplicate QueryDr response as read-only and unchanged', async () => {
    const orderId = new Types.ObjectId('665000000000000000000508');
    const transaction = {
      _id: new Types.ObjectId('665000000000000000000608'),
      order_id: orderId,
      txnRef: 'FSORDERA1',
      status: 'expired',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
      gatewayTransactionId: null,
    };
    mockedOrder.findById.mockReturnValue(leanResult({
      _id: orderId,
      paymentMethod: 'VNPAY',
      paymentStatus: 'pending',
      totalAmount: 385000,
    }) as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(transaction as never);
    mockedQuery.mockResolvedValue({
      isValidSignature: false,
      vnp_ResponseCode: '94',
      vnp_Message: 'Request is duplicated',
    });

    const result = await vnpayReconcileService.reconcileOrder(orderId.toString());

    expect(mockedTransactionService.recordVNPayQueryResult).toHaveBeenCalled();
    expect(mockedSettle).not.toHaveBeenCalled();
    expect(mockedOrderService.markVNPayRefundCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      settlement: null,
      refundedOrder: null,
      reconciliationStatus: 'unchanged',
      duplicateRequest: true,
    });
  });

  it('still rejects unsigned QueryDr responses that could change financial state', async () => {
    const orderId = new Types.ObjectId('665000000000000000000509');
    const transaction = {
      _id: new Types.ObjectId('665000000000000000000609'),
      order_id: orderId,
      txnRef: 'FSORDERA1',
      status: 'pending',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
      gatewayTransactionId: null,
    };
    mockedOrder.findById.mockReturnValue(leanResult({
      _id: orderId,
      paymentMethod: 'VNPAY',
      paymentStatus: 'pending',
      totalAmount: 385000,
    }) as never);
    mockedTransactionService.findLatestAttemptByOrderId.mockResolvedValue(transaction as never);
    mockedQuery.mockResolvedValue({
      isValidSignature: false,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: 'FSORDERA1',
      vnp_Amount: '38500000',
    });

    await expect(
      vnpayReconcileService.reconcileOrder(orderId.toString()),
    ).rejects.toThrow('Invalid VNPay QueryDr response signature');

    expect(mockedSettle).not.toHaveBeenCalled();
  });

  it('completes a full refund only after QueryDr confirms the refund transaction', async () => {
    const orderId = new Types.ObjectId('665000000000000000000502');
    const paymentTransaction = {
      _id: new Types.ObjectId('665000000000000000000602'),
      order_id: orderId,
      txnRef: 'FSORDERA1',
      amount: 385000,
      status: 'success',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
      gatewayTransactionId: '123456',
    };
    const pendingRefund = {
      _id: new Types.ObjectId('665000000000000000000603'),
      order_id: orderId,
      status: 'pending',
      createdAt: new Date('2026-06-18T06:00:00.000Z'),
      paymentDetail: {
        vnp_Command: 'refund',
        vnp_OriginalTxnRef: 'FSORDERA1',
      },
      gatewayTransactionId: null,
    };
    mockedOrder.findById
      .mockReturnValueOnce(leanResult({
        _id: orderId,
        paymentMethod: 'VNPAY',
        paymentStatus: 'paid',
        status: 'returned',
        totalAmount: 385000,
      }) as never)
      .mockReturnValueOnce(leanResult({
        _id: orderId,
        totalAmount: 385000,
      }) as never);
    mockedTransactionService.findLatestSuccessfulByOrderId.mockResolvedValue(paymentTransaction as never);
    mockedTransactionService.findLatestVNPayRefundByOrderId.mockResolvedValue(pendingRefund as never);
    mockedQuery.mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '02',
      vnp_TxnRef: 'FSORDERA1',
      vnp_Amount: '38500000',
      vnp_TransactionNo: '654321',
    });
    mockedOrderService.markVNPayRefundCompleted.mockResolvedValue({ paymentStatus: 'refunded' } as never);

    const result = await vnpayReconcileService.reconcileOrder(orderId.toString());

    expect(mockedTransactionService.resolveVNPayRefundTransaction).toHaveBeenCalledWith({
      transactionId: pendingRefund._id.toString(),
      response: expect.objectContaining({ vnp_TransactionType: '02' }),
    });
    expect(mockedOrderService.markVNPayRefundCompleted).toHaveBeenCalledWith(orderId.toString());
    expect(mockedSettle).not.toHaveBeenCalled();
    expect(result.refundedOrder).toMatchObject({ paymentStatus: 'refunded' });
    expect(result.reconciliationStatus).toBe('refunded');
  });

  it('keeps a pending refund pending when QueryDr only confirms the original payment', async () => {
    const orderId = new Types.ObjectId('665000000000000000000504');
    const pendingRefund = {
      _id: new Types.ObjectId('665000000000000000000606'),
      order_id: orderId,
      status: 'pending',
      createdAt: new Date('2026-06-18T06:00:00.000Z'),
      paymentDetail: {
        vnp_Command: 'refund',
        vnp_OriginalTxnRef: 'FSORDERA1',
      },
      gatewayTransactionId: null,
    };
    const originalPayment = {
      _id: new Types.ObjectId('665000000000000000000607'),
      order_id: orderId,
      txnRef: 'FSORDERA1',
      status: 'success',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
      gatewayTransactionId: '123456',
    };
    mockedOrder.findById.mockReturnValue(leanResult({
      _id: orderId,
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      status: 'returned',
      totalAmount: 385000,
    }) as never);
    mockedTransactionService.findLatestVNPayRefundByOrderId.mockResolvedValue(pendingRefund as never);
    mockedTransactionService.findLatestSuccessfulByOrderId.mockResolvedValue(originalPayment as never);
    mockedQuery.mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '01',
      vnp_TxnRef: 'FSORDERA1',
      vnp_Amount: '38500000',
      vnp_TransactionNo: '123456',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20260618120500',
    });

    const result = await vnpayReconcileService.reconcileOrder(orderId.toString());

    expect(mockedQuery).toHaveBeenCalledWith(expect.objectContaining({
      txnRef: 'FSORDERA1',
      transactionDate: '20260618120000',
      transactionNo: '123456',
    }));
    expect(mockedTransactionService.recordVNPayQueryResult).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: pendingRefund._id.toString(),
    }));
    expect(mockedSettle).not.toHaveBeenCalled();
    expect(mockedTransactionService.resolveVNPayRefundTransaction).not.toHaveBeenCalled();
    expect(mockedOrderService.markVNPayRefundCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      transaction: pendingRefund,
      settlement: null,
      refundedOrder: null,
      reconciliationStatus: 'pending_refund',
    });
  });

  it('automatically reconciles a pending refund using the original payment metadata', async () => {
    const orderId = new Types.ObjectId('665000000000000000000503');
    const pendingRefund = {
      _id: new Types.ObjectId('665000000000000000000604'),
      order_id: orderId,
      status: 'pending',
      gatewayProvider: 'vnpay',
      createdAt: new Date('2026-06-18T06:00:00.000Z'),
      paymentDetail: {
        vnp_Command: 'refund',
        vnp_OriginalTxnRef: 'FSORDERA1',
      },
      gatewayTransactionId: null,
    };
    const originalPayment = {
      _id: new Types.ObjectId('665000000000000000000605'),
      order_id: orderId,
      txnRef: 'FSORDERA1',
      status: 'success',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
      gatewayTransactionId: '123456',
    };
    const limit = jest.fn().mockResolvedValue([pendingRefund]);
    mockedTransaction.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit }),
    } as never);
    mockedTransactionService.findLatestSuccessfulByOrderId.mockResolvedValue(originalPayment as never);
    mockedTransactionService.findLatestVNPayRefundByOrderId.mockResolvedValue(pendingRefund as never);
    mockedOrder.findById.mockReturnValue(leanResult({
      _id: orderId,
      totalAmount: 385000,
    }) as never);
    mockedQuery.mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '02',
      vnp_TxnRef: 'FSORDERA1',
      vnp_Amount: '38500000',
      vnp_TransactionNo: '654321',
    });
    mockedOrderService.markVNPayRefundCompleted.mockResolvedValue({ paymentStatus: 'refunded' } as never);

    const result = await vnpayReconcileService.reconcileStaleTransactions(
      new Date('2026-06-18T07:00:00.000Z'),
    );

    expect(mockedQuery).toHaveBeenCalledWith(expect.objectContaining({
      txnRef: 'FSORDERA1',
      transactionDate: '20260618120000',
      transactionNo: '123456',
    }));
    expect(mockedTransactionService.resolveVNPayRefundTransaction).toHaveBeenCalledWith({
      transactionId: pendingRefund._id.toString(),
      response: expect.objectContaining({ vnp_TransactionType: '02' }),
    });
    expect(result).toMatchObject({ processedCount: 1, updatedCount: 1, failedCount: 0 });
  });
});
