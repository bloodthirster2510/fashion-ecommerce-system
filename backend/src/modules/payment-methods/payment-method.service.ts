import { Types } from 'mongoose';
import {
  PaymentMethod,
  type IPaymentMethod,
  type PaymentMethodStatus,
  type PaymentMethodType,
} from '../../database/models';
import { SalesServiceError } from '../sales/sales.helpers';
import type { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './payment-method.types';

const allowedTypes: PaymentMethodType[] = ['VNPAY', 'MOMO', 'BANK', 'CARD'];
const allowedStatuses: PaymentMethodStatus[] = ['pending', 'verified', 'expired', 'disabled'];
const sensitiveFieldNames = [
  'cardNumber',
  'number',
  'cvv',
  'cvc',
  'otp',
  'password',
  'pin',
  'token',
  'rawToken',
  'secret',
];

const toObjectId = (value: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new SalesServiceError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(value);
};

const assertNoSensitiveFields = (input: Record<string, unknown>) => {
  const loweredKeys = Object.keys(input).map((key) => key.toLowerCase());
  const hasSensitiveField = sensitiveFieldNames.some((field) =>
    loweredKeys.includes(field.toLowerCase()),
  );

  if (hasSensitiveField) {
    throw new SalesServiceError('Raw payment secrets are not accepted', 400);
  }
};

const normalizeType = (type: unknown): PaymentMethodType => {
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : '';

  if (!allowedTypes.includes(normalizedType as PaymentMethodType)) {
    throw new SalesServiceError('Invalid payment method type', 400);
  }

  return normalizedType as PaymentMethodType;
};

const normalizeStatus = (status: unknown): PaymentMethodStatus | undefined => {
  if (status === undefined) return undefined;

  const normalizedStatus = typeof status === 'string' ? status : '';
  if (!allowedStatuses.includes(normalizedStatus as PaymentMethodStatus)) {
    throw new SalesServiceError('Invalid payment method status', 400);
  }

  return normalizedStatus as PaymentMethodStatus;
};

const getProvider = (type: PaymentMethodType, provider?: string) => {
  if (provider?.trim()) return provider.trim().toLowerCase();
  if (type === 'VNPAY') return 'vnpay';
  if (type === 'MOMO') return 'momo';
  if (type === 'CARD') return 'card';
  return 'bank';
};

const getDisplayName = (input: CreatePaymentMethodInput, type: PaymentMethodType) => {
  if (input.displayName?.trim()) return input.displayName.trim();
  if (type === 'VNPAY' && input.bankName?.trim()) return `VNPay ${input.bankName.trim()}`;
  if (type === 'VNPAY') return 'VNPay';
  return type;
};

const getMaskedInfo = (input: CreatePaymentMethodInput, type: PaymentMethodType) => {
  if (input.maskedInfo?.trim()) return input.maskedInfo.trim();
  if (type === 'VNPAY' && input.bankCode?.trim()) return `Bank ${input.bankCode.trim().toUpperCase()}`;
  return null;
};

const unsetDefaultPaymentMethods = (userId: string) =>
  PaymentMethod.updateMany(
    {
      user_id: toObjectId(userId, 'userId'),
      status: { $in: ['pending', 'verified'] },
      isDefault: true,
    },
    { $set: { isDefault: false } },
  );

const serializePaymentMethod = (method: IPaymentMethod) => method;

const listPaymentMethods = async (userId: string) => {
  return PaymentMethod.find({ user_id: toObjectId(userId, 'userId') })
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();
};

const createPaymentMethod = async (userId: string, input: CreatePaymentMethodInput) => {
  assertNoSensitiveFields(input as Record<string, unknown>);

  const type = normalizeType(input.type);
  const existingActiveCount = await PaymentMethod.countDocuments({
    user_id: toObjectId(userId, 'userId'),
    status: { $in: ['pending', 'verified'] },
  });
  const isDefault = Boolean(input.isDefault) || existingActiveCount === 0;

  if (isDefault) {
    await unsetDefaultPaymentMethods(userId);
  }

  const method = await PaymentMethod.create({
    user_id: toObjectId(userId, 'userId'),
    type,
    provider: getProvider(type, input.provider),
    displayName: getDisplayName(input, type),
    maskedInfo: getMaskedInfo(input, type),
    bankCode: input.bankCode?.trim().toUpperCase() || null,
    bankName: input.bankName?.trim() || null,
    status: 'verified',
    isDefault,
    metadata: input.metadata ?? {},
  });

  return serializePaymentMethod(method);
};

const getOwnedPaymentMethod = async (userId: string, id: string) => {
  const method = await PaymentMethod.findOne({
    _id: toObjectId(id, 'paymentMethodId'),
    user_id: toObjectId(userId, 'userId'),
  });

  if (!method) {
    throw new SalesServiceError('Payment method not found', 404);
  }

  return method;
};

const getPaymentMethodById = async (id: string) => {
  const method = await PaymentMethod.findById(toObjectId(id, 'paymentMethodId'));

  if (!method) {
    throw new SalesServiceError('Payment method not found', 404);
  }

  return method;
};

const updatePaymentMethod = async (userId: string, id: string, input: UpdatePaymentMethodInput) => {
  assertNoSensitiveFields(input as Record<string, unknown>);

  const method = await getOwnedPaymentMethod(userId, id);
  const nextStatus = normalizeStatus(input.status);

  if (input.isDefault === true) {
    await unsetDefaultPaymentMethods(userId);
  }

  if (input.displayName !== undefined) method.displayName = input.displayName.trim();
  if (input.maskedInfo !== undefined) method.maskedInfo = input.maskedInfo?.trim() || null;
  if (input.bankCode !== undefined) method.bankCode = input.bankCode?.trim().toUpperCase() || null;
  if (input.bankName !== undefined) method.bankName = input.bankName?.trim() || null;
  if (input.metadata !== undefined) method.metadata = input.metadata;
  if (nextStatus) method.status = nextStatus;
  if (input.isDefault !== undefined) method.isDefault = Boolean(input.isDefault);

  if (method.status === 'disabled' || method.status === 'expired') {
    method.isDefault = false;
  }

  return method.save();
};

const setDefaultPaymentMethod = async (userId: string, id: string) => {
  const method = await getOwnedPaymentMethod(userId, id);

  if (!['pending', 'verified'].includes(method.status)) {
    throw new SalesServiceError('Only active payment methods can be default', 400);
  }

  await unsetDefaultPaymentMethods(userId);
  method.isDefault = true;
  return method.save();
};

const disablePaymentMethod = async (userId: string, id: string) => {
  const method = await getOwnedPaymentMethod(userId, id);
  method.status = 'disabled';
  method.isDefault = false;
  return method.save();
};

const listUserPaymentMethodsForAdmin = async (userId: string) => {
  return PaymentMethod.find({ user_id: toObjectId(userId, 'userId') })
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();
};

const updatePaymentMethodStatusForAdmin = async ({
  id,
  status,
}: {
  id: string;
  status: PaymentMethodStatus;
}) => {
  const method = await getPaymentMethodById(id);
  const before = {
    status: method.status,
    isDefault: method.isDefault,
  };

  method.status = status;
  if (status === 'disabled' || status === 'expired') {
    method.isDefault = false;
  }

  if (status === 'pending' || status === 'verified') {
    const activeDefault = await PaymentMethod.findOne({
      _id: { $ne: method._id },
      user_id: method.user_id,
      status: { $in: ['pending', 'verified'] },
      isDefault: true,
    }).lean();

    if (!activeDefault) {
      method.isDefault = true;
    }
  }

  const savedMethod = await method.save();

  return {
    before,
    method: savedMethod,
    after: {
      status: savedMethod.status,
      isDefault: savedMethod.isDefault,
    },
  };
};

const assertUsablePaymentMethodForCheckout = async ({
  userId,
  paymentMethodId,
  paymentMethod,
}: {
  userId: string;
  paymentMethodId?: string;
  paymentMethod: string;
}) => {
  if (!paymentMethodId) return null;

  const method = await getOwnedPaymentMethod(userId, paymentMethodId);

  if (!['pending', 'verified'].includes(method.status)) {
    throw new SalesServiceError('Payment method is not available', 400);
  }

  if (method.type !== paymentMethod) {
    throw new SalesServiceError('Payment method type does not match checkout method', 400);
  }

  return method;
};

export const paymentMethodService = {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  setDefaultPaymentMethod,
  disablePaymentMethod,
  listUserPaymentMethodsForAdmin,
  updatePaymentMethodStatusForAdmin,
  assertUsablePaymentMethodForCheckout,
};
