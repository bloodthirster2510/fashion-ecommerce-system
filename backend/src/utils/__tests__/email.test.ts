import {
  getResetPasswordEmailCapability,
  sendOrderInvoiceEmail,
  sendResetPasswordEmail,
} from '../email';
import {
  clearMockEmailOutbox,
  getMockEmailOutbox,
} from '../email-provider';

const originalEnv = { ...process.env };

describe('reset password email', () => {
  beforeEach(() => {
    clearMockEmailOutbox();
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.EMAIL_MOCK_RESET_TOKEN = 'mock-reset-token-0000000000000001';
    process.env.PASSWORD_RESET_WEB_URL = 'http://localhost:5173/reset-password';
    process.env.PASSWORD_RESET_MOBILE_URL = 'fashion-ecommerce://reset-password';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('provides a deterministic non-production token without revealing account existence', () => {
    expect(getResetPasswordEmailCapability('customer@example.com')).toEqual({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: expect.stringContaining('fashion-ecommerce://reset-password?'),
    });
  });

  it('writes both mobile and web reset links to the mock outbox', async () => {
    const delivery = await sendResetPasswordEmail(
      'customer@example.com',
      'mock-reset-token-0000000000000001',
    );

    expect(delivery).toMatchObject({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: expect.stringContaining('identifier=customer%40example.com'),
    });
    const [message] = getMockEmailOutbox('customer@example.com');
    expect(message.html).toContain('fashion-ecommerce://reset-password');
    expect(message.html).toContain('http://localhost:5173/reset-password');
    expect(message.html).toContain('token=mock-reset-token-0000000000000001');
  });

  it('renders an escaped order invoice in the customer email', async () => {
    await sendOrderInvoiceEmail({
      to: 'customer@example.com',
      orderId: '665000000000000000000204',
      orderCode: 'FS-001',
      invoiceCode: 'INV-FS-001',
      invoiceIssuedAt: new Date('2026-08-14T08:00:00.000Z'),
      customerName: 'Nguyễn <script>alert(1)</script>',
      paymentMethod: 'VNPAY',
      items: [{
        name: 'Áo sơ mi <limited>',
        sku: 'SHIRT-01',
        color: 'Trắng',
        size: 'M',
        quantity: 2,
        unitPrice: 200_000,
      }],
      subTotal: 400_000,
      discountAmount: 50_000,
      shippingFee: 25_000,
      taxAmount: 0,
      totalAmount: 375_000,
    });

    const [message] = getMockEmailOutbox('customer@example.com');
    expect(message.subject).toContain('INV-FS-001');
    expect(message.html).toContain('Thanh toán cho đơn hàng');
    expect(message.html).toContain('375.000');
    expect(message.html).toContain('Áo sơ mi &lt;limited&gt;');
    expect(message.html).not.toContain('<script>alert(1)</script>');
    expect(message.html).toContain('/account/orders');
  });
});
