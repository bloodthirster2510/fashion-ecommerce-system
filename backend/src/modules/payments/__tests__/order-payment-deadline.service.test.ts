import { Types } from 'mongoose';
import { DistributedLock, Order, Transaction } from '../../../database/models';
import { auditLogService } from '../../audit-logs/audit-log.service';
import { pushNotificationService } from '../../notifications/push-notification.service';
import { orderService } from '../../orders/order.service';
import { orderPaymentDeadlineService } from '../order-payment-deadline.service';

jest.mock('../../../database/models', () => ({
  DistributedLock: { updateOne: jest.fn(), deleteOne: jest.fn() },
  Order: { find: jest.fn(), updateOne: jest.fn() },
  Transaction: { updateMany: jest.fn() },
}));
jest.mock('../../orders/order.service', () => ({
  orderService: { cancelOrderForPaymentDeadline: jest.fn() },
}));
jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: { recordAuditLogBestEffort: jest.fn() },
}));
jest.mock('../../notifications/push-notification.service', () => ({
  pushNotificationService: { sendPaymentDeadlineWarningPush: jest.fn() },
}));

const mockedLock = DistributedLock as jest.Mocked<typeof DistributedLock>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedTransaction = Transaction as jest.Mocked<typeof Transaction>;
const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedAudit = auditLogService as jest.Mocked<typeof auditLogService>;
const mockedPush = pushNotificationService as jest.Mocked<typeof pushNotificationService>;
const chainLean = (value: unknown) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

describe('orderPaymentDeadlineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLock.updateOne.mockResolvedValue({ modifiedCount: 1, upsertedCount: 0 } as never);
    mockedLock.deleteOne.mockResolvedValue({} as never);
    mockedOrder.updateOne.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedTransaction.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedAudit.recordAuditLogBestEffort.mockResolvedValue(undefined);
    mockedPush.sendPaymentDeadlineWarningPush.mockResolvedValue({ sent: 1 } as never);
  });

  it('cancels an overdue unpaid online order and expires its pending transactions', async () => {
    const now = new Date('2026-06-24T08:00:00.000Z');
    const orderId = new Types.ObjectId('665000000000000000000201');
    mockedOrder.find
      .mockReturnValueOnce(chainLean([]) as never)
      .mockReturnValueOnce(chainLean([{ _id: orderId }]) as never);
    mockedOrderService.cancelOrderForPaymentDeadline.mockResolvedValue({
      _id: orderId,
      orderCode: 'FS-DEADLINE',
      status: 'cancelled',
      paymentStatus: 'failed',
      paymentDeadlineAt: now,
      cancellation: { kind: 'payment-timeout' },
    } as never);

    const result = await orderPaymentDeadlineService.sweep(now);

    expect(mockedOrderService.cancelOrderForPaymentDeadline).toHaveBeenCalledWith(orderId.toString(), now);
    expect(mockedTransaction.updateMany).toHaveBeenCalledWith(
      { order_id: orderId, status: 'pending' },
      { $set: { status: 'expired', resolvedAt: now, failureReason: 'order_payment_deadline_exceeded' } },
    );
    expect(mockedAudit.recordAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      actorRole: 'system',
      action: 'payment.expire',
      targetType: 'Order',
      targetId: orderId.toString(),
    }));
    expect(result.cancelledOrderIds).toEqual([orderId.toString()]);
  });

  it('only queries confirmed unpaid online orders whose deadline has passed', async () => {
    const now = new Date('2026-06-24T08:00:00.000Z');
    mockedOrder.find
      .mockReturnValueOnce(chainLean([]) as never)
      .mockReturnValueOnce(chainLean([]) as never);

    await orderPaymentDeadlineService.sweep(now);

    expect(mockedOrder.find).toHaveBeenLastCalledWith({
      status: 'confirmed',
      paymentMethod: { $in: ['VNPAY', 'MOMO', 'CARD', 'BANK'] },
      paymentStatus: { $in: ['pending', 'failed'] },
      paymentDeadlineAt: { $lte: now },
    });
    expect(mockedOrderService.cancelOrderForPaymentDeadline).not.toHaveBeenCalled();
  });

  it('sends one warning and records that it was sent', async () => {
    const now = new Date('2026-06-24T08:00:00.000Z');
    const deadline = new Date('2026-06-25T07:00:00.000Z');
    const orderId = new Types.ObjectId('665000000000000000000202');
    const userId = new Types.ObjectId('665000000000000000000203');
    mockedOrder.find
      .mockReturnValueOnce(chainLean([{
        _id: orderId,
        user_id: userId,
        orderCode: 'FS-WARN',
        paymentDeadlineAt: deadline,
      }]) as never)
      .mockReturnValueOnce(chainLean([]) as never);

    const result = await orderPaymentDeadlineService.sweep(now);

    expect(mockedPush.sendPaymentDeadlineWarningPush).toHaveBeenCalledWith({
      userId: userId.toString(),
      orderId: orderId.toString(),
      orderCode: 'FS-WARN',
      paymentDeadlineAt: deadline,
    });
    expect(mockedOrder.updateOne).toHaveBeenCalledWith(
      { _id: orderId, paymentDeadlineWarningSentAt: null },
      { $set: { paymentDeadlineWarningSentAt: now } },
    );
    expect(result.warnedOrderIds).toEqual([orderId.toString()]);
  });

  it('skips when another instance owns the distributed lock', async () => {
    mockedLock.updateOne.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    await expect(orderPaymentDeadlineService.sweepWithLock()).resolves.toMatchObject({ lockSkipped: true });
    expect(mockedOrder.find).not.toHaveBeenCalled();
  });
});
