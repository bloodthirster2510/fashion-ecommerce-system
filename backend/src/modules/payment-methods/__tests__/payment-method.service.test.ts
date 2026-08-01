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
        refundDestination: false,
      },
    });

    const payload = mockedPaymentMethod.create.mock.calls[0][0] as Record<string, unknown>;
    expect((payload.user_id as Types.ObjectId).toString()).toBe(userId);
    expect(payload.status).toBe('pending');
    expect(payload.isDefault).toBe(false);
    expect(payload.accountNumberEncrypted).toEqual(expect.stringMatching(/^v1:/));
    expect(payload.accountNumberEncrypted).not.toContain('0123456789');
    expect(payload.metadata).toEqual(expect.objectContaining({ refundDestination: true }));
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

  it('rejects customer-added methods that are not bank refund accounts', async () => {
    await expect(
      paymentMethodService.createPaymentMethod(userId, {
        type: 'VNPAY',
        bankCode: 'VCB',
      }),
    ).rejects.toThrow('Only bank refund accounts can be added');

    expect(mockedPaymentMethod.create).not.toHaveBeenCalled();
  });

  it.each([
    { metadata: { accountNumber: '0123456789' } },
    { metadata: { account_number: '0123456789' } },
    { metadata: { bankAccountNumber: '0123456789' } },
    { accountNumberEncrypted: 'plaintext-is-not-allowed' },
  ])('rejects account secrets outside the dedicated encrypted input', async (unsafeInput) => {
    await expect(
      paymentMethodService.createPaymentMethod(userId, {
        type: 'BANK',
        bankCode: 'VCB',
        ...unsafeInput,
      }),
    ).rejects.toThrow('Raw payment secrets are not accepted');

    expect(mockedPaymentMethod.create).not.toHaveBeenCalled();
  });

  it('keeps only allowlisted refund metadata', async () => {
    mockedPaymentMethod.countDocuments.mockResolvedValue(0);
    mockedPaymentMethod.create.mockImplementation(async (payload) => payload as never);

    await paymentMethodService.createPaymentMethod(userId, {
      type: 'BANK',
      bankCode: 'VCB',
      metadata: {
        accountHolder: ' NGUYEN VAN A ',
        bankFullName: 'Vietcombank',
        accountNumberLast4: '6789',
        refundDestination: false,
        customerNote: 'must not be persisted',
      },
    });

    expect(mockedPaymentMethod.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        accountHolder: 'NGUYEN VAN A',
        bankFullName: 'Vietcombank',
        accountNumberLast4: '6789',
        refundDestination: true,
      },
    }));
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
    ).rejects.toThrow('Only verified refund accounts can be default');

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
        refundDestination: false,
      },
    });

    expect(method.status).toBe('pending');
    expect(method.isDefault).toBe(false);
    expect(method.metadata).toEqual(expect.objectContaining({ refundDestination: true }));
    expect(method.save).toHaveBeenCalled();
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
