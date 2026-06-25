import { Types } from 'mongoose';
import { PaymentMethod } from '../../../database/models';
import { paymentMethodService } from '../payment-method.service';

jest.mock('../../../database/models', () => ({
  PaymentMethod: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockedPaymentMethod = PaymentMethod as jest.Mocked<typeof PaymentMethod>;
const userId = '665000000000000000000020';
const paymentMethodId = '665000000000000000000090';

describe('paymentMethodService', () => {
  const previousEncryptionSecret = process.env.PAYMENT_METHOD_ENCRYPTION_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYMENT_METHOD_ENCRYPTION_SECRET = 'test-payment-method-secret';
    mockedPaymentMethod.updateMany.mockResolvedValue({} as never);
  });

  afterAll(() => {
    process.env.PAYMENT_METHOD_ENCRYPTION_SECRET = previousEncryptionSecret;
  });

  it('creates bank refund accounts as pending and never defaults them immediately', async () => {
    mockedPaymentMethod.countDocuments.mockResolvedValue(0);
    mockedPaymentMethod.create.mockImplementation(async (payload) => payload as never);

    await paymentMethodService.createPaymentMethod(userId, {
      type: 'BANK',
      displayName: 'Hoan tien Vietcombank',
      maskedInfo: '•••• 1234',
      bankCode: 'vcb',
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      isDefault: true,
      metadata: {
        accountHolder: 'NGUYEN VAN A',
        accountNumberLast4: '1234',
        refundDestination: true,
      },
    });

    const payload = mockedPaymentMethod.create.mock.calls[0][0] as Record<string, unknown>;
    expect((payload.user_id as Types.ObjectId).toString()).toBe(userId);
    expect(payload.status).toBe('pending');
    expect(payload.isDefault).toBe(false);
    expect(payload.accountNumberEncrypted).toEqual(expect.stringMatching(/^v1:/));
    expect(payload.accountNumberEncrypted).not.toContain('0123456789');
    expect(mockedPaymentMethod.updateMany).not.toHaveBeenCalled();
  });

  it('reveals the encrypted bank account number for admin refund transfer', async () => {
    mockedPaymentMethod.countDocuments.mockResolvedValue(0);
    mockedPaymentMethod.create.mockImplementation(async (payload) => payload as never);

    await paymentMethodService.createPaymentMethod(userId, {
      type: 'BANK',
      displayName: 'Hoan tien Vietcombank',
      maskedInfo: '•••• 6789',
      bankCode: 'VCB',
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
    });

    const createdPayload = mockedPaymentMethod.create.mock.calls[0][0] as Record<string, unknown>;
    const method = {
      _id: new Types.ObjectId(paymentMethodId),
      user_id: new Types.ObjectId(userId),
      type: 'BANK',
      accountNumberEncrypted: createdPayload.accountNumberEncrypted,
    };
    mockedPaymentMethod.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(method),
    } as never);

    const result = await paymentMethodService.revealPaymentMethodAccountNumberForAdmin(paymentMethodId);

    expect(result.accountNumber).toBe('0123456789');
  });

  it('creates the first VNPay method as verified and default', async () => {
    mockedPaymentMethod.countDocuments.mockResolvedValue(0);
    mockedPaymentMethod.create.mockImplementation(async (payload) => payload as never);

    await paymentMethodService.createPaymentMethod(userId, {
      type: 'VNPAY',
      bankCode: 'VCB',
    });

    const payload = mockedPaymentMethod.create.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe('verified');
    expect(payload.isDefault).toBe(true);
    expect(mockedPaymentMethod.updateMany).toHaveBeenCalledWith(
      {
        user_id: expect.any(Types.ObjectId),
        status: { $in: ['verified'] },
        isDefault: true,
      },
      { $set: { isDefault: false } },
    );
  });

  it('does not let customers set a pending method as default', async () => {
    mockedPaymentMethod.findOne.mockResolvedValue({
      _id: new Types.ObjectId(paymentMethodId),
      user_id: new Types.ObjectId(userId),
      status: 'pending',
      isDefault: false,
    } as never);

    await expect(
      paymentMethodService.setDefaultPaymentMethod(userId, paymentMethodId),
    ).rejects.toThrow('Only verified payment methods can be default');

    expect(mockedPaymentMethod.updateMany).not.toHaveBeenCalled();
  });

  it('moves verified bank refund accounts back to pending when customer edits bank details', async () => {
    const method = {
      _id: new Types.ObjectId(paymentMethodId),
      user_id: new Types.ObjectId(userId),
      type: 'BANK',
      displayName: 'Hoan tien Vietcombank',
      maskedInfo: '•••• 1234',
      bankCode: 'VCB',
      bankName: 'Vietcombank',
      status: 'verified',
      isDefault: true,
      metadata: {
        accountHolder: 'NGUYEN VAN A',
        accountNumberLast4: '1234',
      },
      save: jest.fn(),
      toObject: jest.fn(function toObject() {
        return { ...this };
      }),
    };
    method.save.mockResolvedValue(method);
    mockedPaymentMethod.findOne.mockResolvedValue(method as never);

    await paymentMethodService.updatePaymentMethod(userId, paymentMethodId, {
      bankCode: 'TCB',
      bankName: 'Techcombank',
      metadata: {
        accountHolder: 'NGUYEN VAN A',
        accountNumberLast4: '1234',
        refundDestination: true,
      },
    });

    expect(method.status).toBe('pending');
    expect(method.isDefault).toBe(false);
    expect(method.save).toHaveBeenCalled();
  });

  it('rejects checkout with a pending saved payment method', async () => {
    mockedPaymentMethod.findOne.mockResolvedValue({
      _id: new Types.ObjectId(paymentMethodId),
      user_id: new Types.ObjectId(userId),
      type: 'VNPAY',
      status: 'pending',
    } as never);

    await expect(
      paymentMethodService.assertUsablePaymentMethodForCheckout({
        userId,
        paymentMethodId,
        paymentMethod: 'VNPAY',
      }),
    ).rejects.toThrow('Payment method is not available');
  });

  it('lets admin verification promote a method to default when no verified default exists', async () => {
    const method = {
      _id: new Types.ObjectId(paymentMethodId),
      user_id: new Types.ObjectId(userId),
      status: 'pending',
      isDefault: false,
      save: jest.fn(),
    };
    method.save.mockResolvedValue(method);
    mockedPaymentMethod.findById.mockResolvedValue(method as never);
    mockedPaymentMethod.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as never);

    await paymentMethodService.updatePaymentMethodStatusForAdmin({
      id: paymentMethodId,
      status: 'verified',
    });

    expect(method.status).toBe('verified');
    expect(method.isDefault).toBe(true);
    expect(method.save).toHaveBeenCalled();
  });
});
