import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { auditLogService } from '../../audit-logs/audit-log.service';
import {
  bulkProcessGhnShipments,
  bulkUpdateOrderStatus,
  exportOrdersCsv,
  handleGhnShippingWebhook,
} from '../order.controller';
import { orderService } from '../order.service';

jest.mock('../order.service', () => ({
  orderService: {
    applyGhnShippingWebhook: jest.fn(),
    cancelOrder: jest.fn(),
    createGhnShipment: jest.fn(),
    getOrderById: jest.fn(),
    getOrdersForExport: jest.fn(),
    syncGhnShipment: jest.fn(),
    updateOrderStatus: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

const mockedOrderService = orderService as jest.Mocked<typeof orderService>;
const mockedAudit = auditLogService as jest.Mocked<typeof auditLogService>;

const createResponse = () => {
  const res = {
    send: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res as unknown as Response & {
    send: jest.Mock;
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe('handleGhnShippingWebhook', () => {
  const originalSecret = process.env.GHN_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GHN_WEBHOOK_SECRET = 'test-ghn-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.GHN_WEBHOOK_SECRET;
    else process.env.GHN_WEBHOOK_SECRET = originalSecret;
  });

  it('accepts the callback secret from the query string used in the GHN callback URL', async () => {
    const orderId = new Types.ObjectId('665000000000000000000801');
    const order = {
      _id: orderId,
      orderCode: 'FSORDER',
      status: 'shipping',
      paymentStatus: 'paid',
      deliveredAt: null,
      shipping: { status: 'shipping', trackingCode: 'GHN123' },
    };
    mockedOrderService.applyGhnShippingWebhook.mockResolvedValue({
      order,
      reason: 'GHN reported shipping',
      before: { status: 'packed' },
    } as never);
    mockedAudit.recordAuditLogBestEffort.mockResolvedValue(undefined);
    const req = {
      query: { token: 'test-ghn-secret' },
      headers: {},
      body: { OrderCode: 'GHN123', Status: 'shipping' },
    } as unknown as Request;
    const res = createResponse();

    await handleGhnShippingWebhook(req, res);

    expect(mockedOrderService.applyGhnShippingWebhook).toHaveBeenCalledWith(req.body);
    expect(mockedAudit.recordAuditLogBestEffort).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a GHN callback before processing when the secret is invalid', async () => {
    const req = {
      query: { token: 'wrong-secret' },
      headers: {},
      body: { OrderCode: 'GHN123', Status: 'delivered' },
    } as unknown as Request;
    const res = createResponse();

    await handleGhnShippingWebhook(req, res);

    expect(mockedOrderService.applyGhnShippingWebhook).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid GHN webhook secret',
    }));
  });
});

describe('admin order bulk operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAudit.recordAuditLogBestEffort.mockResolvedValue(undefined);
  });

  it('returns a per-order result and keeps successful status updates when another order fails', async () => {
    const firstId = '665000000000000000000811';
    const secondId = '665000000000000000000812';
    const beforeOrder = {
      _id: new Types.ObjectId(firstId),
      orderCode: 'FS-BULK-1',
      status: 'confirmed',
      paymentStatus: 'paid',
    };
    const updatedOrder = {
      ...beforeOrder,
      status: 'packed',
    };
    mockedOrderService.getOrderById
      .mockResolvedValueOnce(beforeOrder as never)
      .mockRejectedValueOnce(new Error('Order not found'));
    mockedOrderService.updateOrderStatus.mockResolvedValue(updatedOrder as never);
    const req = {
      body: {
        orderIds: [firstId, secondId],
        status: 'packed',
        reason: 'Bàn giao ca vận hành',
      },
      user: { userId: '665000000000000000000899', role: 'admin' },
    } as unknown as Request;
    const res = createResponse();

    await bulkUpdateOrderStatus(req, res);

    expect(mockedOrderService.updateOrderStatus).toHaveBeenCalledWith(firstId, {
      status: 'packed',
      reason: 'Bàn giao ca vận hành',
    });
    expect(mockedAudit.recordAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      targetId: firstId,
      reason: 'Bàn giao ca vận hành',
      metadata: expect.objectContaining({ bulk: true }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requestedCount: 2,
        succeededCount: 1,
        failedCount: 1,
        results: [
          expect.objectContaining({ orderId: firstId, success: true }),
          expect.objectContaining({ orderId: secondId, success: false, message: 'Order not found' }),
        ],
      }),
    }));
  });

  it('processes GHN rows sequentially and reports ineligible orders without rolling back the batch', async () => {
    const createId = '665000000000000000000821';
    const failedId = '665000000000000000000822';
    const beforeOrder = {
      _id: new Types.ObjectId(createId),
      orderCode: 'FS-GHN-1',
      status: 'packed',
      paymentStatus: 'paid',
      shipping: null,
    };
    const updatedOrder = {
      ...beforeOrder,
      shipping: {
        provider: 'GHN',
        trackingCode: 'GHN-BULK-1',
        status: 'ready',
      },
    };
    mockedOrderService.getOrderById
      .mockResolvedValueOnce(beforeOrder as never)
      .mockRejectedValueOnce(new Error('GHN mapping is required'));
    mockedOrderService.createGhnShipment.mockResolvedValue(updatedOrder as never);
    const req = {
      body: {
        orderIds: [createId, failedId],
        action: 'create',
        reason: 'Tạo vận đơn sau khi đóng gói',
      },
      user: { userId: '665000000000000000000899', role: 'staff' },
    } as unknown as Request;
    const res = createResponse();

    await bulkProcessGhnShipments(req, res);

    expect(mockedOrderService.createGhnShipment).toHaveBeenCalledTimes(1);
    expect(mockedAudit.recordAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      actorRole: 'staff',
      reason: 'Tạo vận đơn sau khi đóng gói',
      metadata: expect.objectContaining({
        bulk: true,
        ghnAction: 'create',
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        succeededCount: 1,
        failedCount: 1,
      }),
    }));
  });
});

describe('exportOrdersCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the complete filter result as UTF-8 CSV and neutralizes spreadsheet formulas', async () => {
    mockedOrderService.getOrdersForExport.mockResolvedValue({
      items: [{
        orderCode: 'FS-CSV-1',
        invoiceCode: 'INV-1',
        order_list: [{ quantity: 1, name: '@Áo sơ mi' }],
        shippingAddress: {
          customerName: '=HYPERLINK("https://example.com")',
          phoneNumber: '0900000000',
        },
        createdAt: new Date('2026-07-29T00:00:00.000Z'),
        status: 'delivered',
        paymentMethod: 'VNPAY',
        paymentStatus: 'paid',
        subTotal: 100000,
        shippingFee: 20000,
        couponDiscountAmount: 10000,
        shippingDiscountAmount: 0,
        membershipDiscountAmount: 0,
        totalAmount: 110000,
        shipping: {
          provider: 'GHN',
          trackingCode: 'GHN-CSV-1',
          labelUrl: 'https://example.com/label.pdf',
        },
      }],
      totalItems: 1,
      truncated: false,
    } as never);
    const req = {
      query: { paymentStatus: 'paid', sort: 'created_desc' },
    } as unknown as Request;
    const res = createResponse();

    await exportOrdersCsv(req, res);

    expect(mockedOrderService.getOrdersForExport).toHaveBeenCalledWith(expect.objectContaining({
      paymentStatus: 'paid',
      sort: 'created_desc',
    }));
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('X-Export-Total', '1');
    const csv = res.send.mock.calls[0][0] as string;
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""https://example.com"")"`);
    expect(csv).toContain('"1x @Áo sơ mi"');
  });
});
