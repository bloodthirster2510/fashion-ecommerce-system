import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { User, type StaffPermission } from '../../../database/models/user.model';
import { generateAccessToken } from '../../../utils/jwt';
import { adminPaymentMethodRouter } from '../../payment-methods/payment-method.route';
import { adminPaymentRouter } from '../payments.route';

jest.mock('../payments.controller', () => {
  const noContent = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) =>
    res.status(204).end();
  return {
    adjustOrderPaymentStatus: noContent,
    createVNPayUrlFromOrder: noContent,
    expireStalePaymentAttempts: noContent,
    getOrderPaymentStatus: noContent,
    handleVNPayIpn: noContent,
    handleVNPayReturn: noContent,
  };
});

jest.mock('../vnpay-admin.controller', () => {
  const noContent = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) =>
    res.status(204).end();
  return {
    reconcileVNPayOrder: noContent,
    refundVNPayOrder: noContent,
  };
});

jest.mock('../../payment-methods/payment-method.controller', () => {
  const noContent = (_req: unknown, res: { status: (code: number) => { end: () => unknown } }) =>
    res.status(204).end();
  return {
    adminListUserPaymentMethods: noContent,
    adminRevealPaymentMethodAccountNumber: noContent,
    adminUpdatePaymentMethodStatus: noContent,
    createPaymentMethod: noContent,
    deletePaymentMethod: noContent,
    listPaymentMethods: noContent,
    setDefaultPaymentMethod: noContent,
    updatePaymentMethod: noContent,
  };
});

jest.mock('../../../database/models/user.model', () => ({
  User: { findById: jest.fn() },
}));

const mockedUser = User as jest.Mocked<typeof User>;

const mockAccount = (role: 'admin' | 'staff', permissions: StaffPermission[] = []) => {
  const lean = jest.fn().mockResolvedValue({
    role,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    permissions,
  });
  const select = jest.fn().mockReturnValue({ lean });
  mockedUser.findById.mockReturnValue({ select } as never);
};

describe('payment route permissions', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/admin/payments', adminPaymentRouter);
    app.use('/admin', adminPaymentMethodRouter);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((caught) => caught ? reject(caught) : resolve());
    });
  });

  beforeEach(() => jest.clearAllMocks());

  const token = (role: 'admin' | 'staff') => generateAccessToken({
    userId: '665000000000000000000001',
    email: `${role}@example.com`,
    role,
  });

  const request = (path: string, method: 'PATCH' | 'POST', accessToken: string) => fetch(
    `${baseUrl}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentStatus: 'refunded', reason: 'Verified refund operation' }),
    },
  );

  const protectedOperations = [
    { path: '/admin/payments/orders/665000000000000000000010/payment-status', method: 'PATCH' as const },
    { path: '/admin/payments/orders/665000000000000000000010/vnpay/reconcile', method: 'POST' as const },
    { path: '/admin/payments/orders/665000000000000000000010/vnpay/refund', method: 'POST' as const },
    { path: '/admin/payment-methods/665000000000000000000020/reveal-account', method: 'POST' as const },
  ];

  it('blocks staff without payments.adjust from every sensitive payment operation', async () => {
    mockAccount('staff', ['orders.read', 'orders.update', 'customers.read']);

    for (const operation of protectedOperations) {
      await expect(request(operation.path, operation.method, token('staff')))
        .resolves.toMatchObject({ status: 403 });
    }
  });

  it('allows staff with payments.adjust to use the sensitive payment operations', async () => {
    mockAccount('staff', ['orders.read', 'payments.adjust']);

    for (const operation of protectedOperations) {
      await expect(request(operation.path, operation.method, token('staff')))
        .resolves.toMatchObject({ status: 204 });
    }
  });

  it('allows admins to bypass the explicit staff permission list', async () => {
    mockAccount('admin');

    for (const operation of protectedOperations) {
      await expect(request(operation.path, operation.method, token('admin')))
        .resolves.toMatchObject({ status: 204 });
    }
  });
});
