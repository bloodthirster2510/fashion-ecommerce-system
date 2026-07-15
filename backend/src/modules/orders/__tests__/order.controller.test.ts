import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { auditLogService } from '../../audit-logs/audit-log.service';
import { handleGhnShippingWebhook } from '../order.controller';
import { orderService } from '../order.service';

jest.mock('../order.service', () => ({
  orderService: {
    applyGhnShippingWebhook: jest.fn(),
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
