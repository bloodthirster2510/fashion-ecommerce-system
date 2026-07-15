import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { auditLogService } from '../../audit-logs/audit-log.service';
import { orderService } from '../../orders/order.service';
import { refundVNPayTransaction } from '../payments.service';
import { transactionService } from '../transaction.service';
import { refundVNPayOrder } from '../vnpay-admin.controller';

jest.mock('../../orders/order.service', () => ({
  orderService: {
    getOrderById: jest.fn(),
    markVNPayRefundCompleted: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

jest.mock('../payments.service', () => ({
  getVNPayServerIp: jest.fn(() => '203.0.113.10'),
  refundVNPayTransaction: jest.fn(),
}));

jest.mock('../transaction.service', () => ({
  transactionService: {
    findLatestVNPayRefundByOrderId: jest.fn(),
    findLatestSuccessfulByOrderId: jest.fn(),
    createVNPayRefundTransaction: jest.fn(),
  },
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedTransactionService = transactionService as jest.Mocked<typeof transactionService>;
const mockedRefund = refundVNPayTransaction as jest.MockedFunction<typeof refundVNPayTransaction>;
const mockedAudit = auditLogService as jest.Mocked<typeof auditLogService>;

const createResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe('refundVNPayOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records response 94 as a pending refund and uses the configured server IP', async () => {
    const orderId = new Types.ObjectId('665000000000000000000701');
    const userId = new Types.ObjectId('665000000000000000000702');
    const actorId = new Types.ObjectId('665000000000000000000703');
    const paymentTransactionId = new Types.ObjectId('665000000000000000000704');
    const refundTransactionId = new Types.ObjectId('665000000000000000000705');
    const order = {
      _id: orderId,
      user_id: userId,
      status: 'returned',
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      totalAmount: 385000,
    };
    const paymentTransaction = {
      _id: paymentTransactionId,
      txnRef: 'FSORDERA1',
      gatewayTransactionId: '123456',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
    };
    const refundTransaction = {
      _id: refundTransactionId,
      status: 'pending',
    };
    mockedOrderService.getOrderById.mockResolvedValue(order as never);
    mockedTransactionService.findLatestVNPayRefundByOrderId.mockResolvedValue(null);
    mockedTransactionService.findLatestSuccessfulByOrderId.mockResolvedValue(paymentTransaction as never);
    mockedRefund.mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '94',
      vnp_TransactionStatus: '05',
      vnp_TransactionType: '02',
      vnp_TxnRef: 'FSORDERA1',
    });
    mockedTransactionService.createVNPayRefundTransaction.mockResolvedValue(refundTransaction as never);
    mockedAudit.recordAuditLogBestEffort.mockResolvedValue(undefined);

    const req = {
      params: { orderId: orderId.toString() },
      body: { reason: 'Customer returned the item' },
      user: { userId: actorId.toString(), role: 'admin' },
    } as unknown as Request;
    const res = createResponse();

    await refundVNPayOrder(req, res);

    expect(mockedRefund).toHaveBeenCalledWith(expect.objectContaining({
      txnRef: 'FSORDERA1',
      transactionDate: '20260618120000',
      transactionNo: '123456',
      amount: 385000,
      ipAddr: '203.0.113.10',
    }));
    expect(mockedTransactionService.createVNPayRefundTransaction).toHaveBeenCalled();
    expect(mockedOrderService.markVNPayRefundCompleted).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ refundStatus: 'pending' }),
    }));
  });

  it('rejects gateway refunds before an order is cancelled or physically returned', async () => {
    const orderId = new Types.ObjectId('665000000000000000000706');
    mockedOrderService.getOrderById.mockResolvedValue({
      _id: orderId,
      status: 'return_approved',
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
    } as never);
    const req = {
      params: { orderId: orderId.toString() },
      body: { reason: 'Customer return approved' },
      user: { userId: new Types.ObjectId().toString(), role: 'admin' },
    } as unknown as Request;
    const res = createResponse();

    await refundVNPayOrder(req, res);

    expect(mockedRefund).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Order must be cancelled or returned before refund',
    }));
  });

  it('fails closed when VNPay confirms a non-refund transaction type', async () => {
    const orderId = new Types.ObjectId('665000000000000000000707');
    const actorId = new Types.ObjectId('665000000000000000000708');
    mockedOrderService.getOrderById.mockResolvedValue({
      _id: orderId,
      user_id: new Types.ObjectId('665000000000000000000709'),
      status: 'returned',
      paymentMethod: 'VNPAY',
      paymentStatus: 'paid',
      totalAmount: 385000,
    } as never);
    mockedTransactionService.findLatestVNPayRefundByOrderId.mockResolvedValue(null);
    mockedTransactionService.findLatestSuccessfulByOrderId.mockResolvedValue({
      _id: new Types.ObjectId('665000000000000000000710'),
      txnRef: 'FSORDERA1',
      gatewayTransactionId: '123456',
      createdAt: new Date('2026-06-18T05:00:00.000Z'),
      paymentDetail: { vnp_CreateDate: '20260618120000' },
    } as never);
    mockedRefund.mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '01',
      vnp_TxnRef: 'FSORDERA1',
      vnp_Amount: '38500000',
    });
    const req = {
      params: { orderId: orderId.toString() },
      body: { reason: 'Customer returned the item' },
      user: { userId: actorId.toString(), role: 'admin' },
    } as unknown as Request;
    const res = createResponse();

    await refundVNPayOrder(req, res);

    expect(mockedTransactionService.createVNPayRefundTransaction).not.toHaveBeenCalled();
    expect(mockedOrderService.markVNPayRefundCompleted).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'VNPay full refund transaction type mismatch',
    }));
  });
});
