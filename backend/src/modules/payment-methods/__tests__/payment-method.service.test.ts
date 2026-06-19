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
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPaymentMethod.updateMany.mockResolvedValue({} as never);
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
    expect(mockedPaymentMethod.updateMany).not.toHaveBeenCalled();
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
