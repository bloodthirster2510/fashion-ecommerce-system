import { Types } from 'mongoose';
import { DistributedLock, Order } from '../../../database/models';
import { orderService } from '../../orders/order.service';
import { shippingReconcileService } from '../shipping-reconcile.service';

jest.mock('../../../database/models', () => ({
  DistributedLock: { updateOne: jest.fn(), deleteOne: jest.fn() },
  Order: { find: jest.fn() },
}));
jest.mock('../../orders/order.service', () => ({
  orderService: { syncGhnShipment: jest.fn() },
}));

const mockedLock = DistributedLock as jest.Mocked<typeof DistributedLock>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedOrderService = orderService as jest.Mocked<typeof orderService>;

const mockOrders = (orders: Array<{ _id: Types.ObjectId }>) => {
  const lean = jest.fn().mockResolvedValue(orders);
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ sort });
  mockedOrder.find.mockReturnValue({ select } as never);
};

describe('shippingReconcileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLock.updateOne.mockResolvedValue({ modifiedCount: 1, upsertedCount: 0 } as never);
    mockedLock.deleteOne.mockResolvedValue({} as never);
  });

  it('syncs stale GHN orders and counts status changes', async () => {
    const orderId = new Types.ObjectId('665000000000000000000101');
    mockOrders([{ _id: orderId }]);
    mockedOrderService.syncGhnShipment.mockResolvedValue({
      before: { status: 'shipping', paymentStatus: 'paid', deliveredAt: null, shipping: { status: 'picked' } },
      order: { status: 'shipping', shipping: { status: 'shipping' } },
      reason: 'synced',
    } as never);

    const result = await shippingReconcileService.reconcileStaleShipments(new Date('2026-06-24T08:00:00.000Z'));

    expect(mockedOrderService.syncGhnShipment).toHaveBeenCalledWith(orderId.toString());
    expect(result).toMatchObject({ processedCount: 1, updatedCount: 1, failedCount: 0 });
  });

  it('keeps processing after one GHN request fails', async () => {
    const firstId = new Types.ObjectId('665000000000000000000101');
    const secondId = new Types.ObjectId('665000000000000000000102');
    mockOrders([{ _id: firstId }, { _id: secondId }]);
    mockedOrderService.syncGhnShipment
      .mockRejectedValueOnce(new Error('GHN timeout'))
      .mockResolvedValueOnce({
        before: { status: 'shipping', shipping: { status: 'shipping' } },
        order: { status: 'shipping', shipping: { status: 'shipping' } },
      } as never);

    const result = await shippingReconcileService.reconcileStaleShipments();
    expect(result).toMatchObject({ processedCount: 2, updatedCount: 0, failedCount: 1 });
    expect(result.failures[0]).toMatchObject({ orderId: firstId.toString(), message: 'GHN timeout' });
  });

  it('skips reconciliation when another instance owns the lock', async () => {
    mockedLock.updateOne.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    await expect(shippingReconcileService.reconcileStaleShipmentsWithLock()).resolves.toMatchObject({
      lockSkipped: true,
      processedCount: 0,
    });
    expect(mockedOrder.find).not.toHaveBeenCalled();
  });
});
