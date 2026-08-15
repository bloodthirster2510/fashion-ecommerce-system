import { Types } from 'mongoose';
import { Order, User } from '../../../database/models';
import { sendOrderInvoiceEmail } from '../../../utils/email';
import { storefrontSettingsService } from '../../storefront-settings/storefront-settings.service';
import { buildOrderInvoicePdf } from '../invoice-pdf.service';
import { sendPaidOrderInvoiceEmailBestEffort } from '../invoice-email.service';

jest.mock('../../../database/models', () => ({
  Order: {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../utils/email', () => ({
  sendOrderInvoiceEmail: jest.fn(),
}));

jest.mock('../../storefront-settings/storefront-settings.service', () => ({
  storefrontSettingsService: {
    getPublicSettings: jest.fn(),
  },
}));

jest.mock('../invoice-pdf.service', () => ({
  buildOrderInvoicePdf: jest.fn(),
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedUser = User as jest.Mocked<typeof User>;
const mockedSendOrderInvoiceEmail = sendOrderInvoiceEmail as jest.MockedFunction<typeof sendOrderInvoiceEmail>;
const mockedGetPublicSettings = storefrontSettingsService.getPublicSettings as jest.MockedFunction<
  typeof storefrontSettingsService.getPublicSettings
>;
const mockedBuildOrderInvoicePdf = buildOrderInvoicePdf as jest.MockedFunction<typeof buildOrderInvoicePdf>;

const chainUserEmail = (email?: string) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(email ? { email } : null),
  }),
});

describe('sendPaidOrderInvoiceEmailBestEffort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedOrder.updateOne.mockResolvedValue({ acknowledged: true } as never);
    mockedSendOrderInvoiceEmail.mockResolvedValue({ mode: 'mock', provider: 'mock' });
    mockedGetPublicSettings.mockResolvedValue({ storeName: 'CDShop' } as never);
    mockedBuildOrderInvoicePdf.mockResolvedValue(Buffer.from('%PDF-1.4 test invoice'));
  });

  it('issues and sends a paid invoice once', async () => {
    const orderId = new Types.ObjectId('665000000000000000000204');
    const userId = new Types.ObjectId('665000000000000000000104');
    const paidOrder = {
      _id: orderId,
      user_id: userId,
      orderCode: 'FS-001',
      invoiceCode: null,
      invoiceIssuedAt: null,
      paymentStatus: 'paid',
      paymentMethod: 'VNPAY',
      shippingAddress: { customerName: 'Nguyễn Văn A' },
      order_list: [{
        name: 'Áo sơ mi',
        sku: 'SHIRT-01',
        color: 'Trắng',
        size: 'M',
        quantity: 2,
        priceAtPurchased: 200_000,
      }],
      subTotal: 400_000,
      couponDiscountAmount: 50_000,
      shippingDiscountAmount: 0,
      membershipDiscountAmount: 0,
      shippingFee: 25_000,
      taxAmount: 0,
      totalAmount: 375_000,
    };
    const claimedOrder = {
      ...paidOrder,
      invoiceCode: 'INV-FS-001',
      invoiceIssuedAt: new Date('2026-08-14T08:00:00.000Z'),
    };

    mockedOrder.findById.mockResolvedValue(paidOrder as never);
    mockedOrder.findOneAndUpdate
      .mockResolvedValueOnce(claimedOrder as never)
      .mockResolvedValueOnce(null);
    mockedUser.findById.mockReturnValue(chainUserEmail('customer@example.com') as never);

    await expect(sendPaidOrderInvoiceEmailBestEffort(orderId.toString())).resolves.toBe(true);
    await expect(sendPaidOrderInvoiceEmailBestEffort(orderId.toString())).resolves.toBe(false);

    expect(mockedSendOrderInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendOrderInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'customer@example.com',
      orderCode: 'FS-001',
      invoiceCode: 'INV-FS-001',
      totalAmount: 375_000,
      pdf: expect.any(Buffer),
    }));
    expect(mockedOrder.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: orderId }),
      expect.objectContaining({
        $set: expect.objectContaining({ invoiceEmailSentAt: expect.any(Date) }),
        $unset: { invoiceEmailSendingAt: 1 },
      }),
    );
  });

  it('does not issue or send an invoice for an unpaid order', async () => {
    mockedOrder.findById.mockResolvedValue({ paymentStatus: 'pending' } as never);

    await expect(
      sendPaidOrderInvoiceEmailBestEffort('665000000000000000000204'),
    ).resolves.toBe(false);

    expect(mockedOrder.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockedSendOrderInvoiceEmail).not.toHaveBeenCalled();
  });
});
