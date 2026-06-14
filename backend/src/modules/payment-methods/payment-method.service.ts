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
const DEFAULTABLE_STATUSES: PaymentMethodStatus[] = ['verified'];
const CHECKOUT_USABLE_STATUSES: PaymentMethodStatus[] = ['verified'];
const sensitiveFieldNames = [
  'accountNumber',
  'account_number',
  'bankAccountNumber',
  'bank_account_number',
  'cardNumber',
  'card_number',
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

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertNoSensitiveFields = (input: Record<string, unknown>) => {
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!isPlainRecord(value)) {
      return;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
      const loweredKey = key.toLowerCase();
      const hasSensitiveField = sensitiveFieldNames.some((field) =>
        loweredKey === field.toLowerCase(),
      );

      if (hasSensitiveField) {
        throw new SalesServiceError('Raw payment secrets are not accepted', 400);
      }

      visit(nestedValue);
    });
  };

  visit(input);
};

const sanitizeMetadata = (value: unknown) => {
  if (!isPlainRecord(value)) return {};

  const result: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, nestedValue]) => {
    if (typeof nestedValue === 'string') {
      const trimmedValue = nestedValue.trim();
      if (trimmedValue) result[key] = trimmedValue;
      return;
    }

    if (typeof nestedValue === 'boolean' || typeof nestedValue === 'number' || nestedValue === null) {
      result[key] = nestedValue;
    }
  });

  return result;
};

const normalizeMaskedInfo = (value?: string | null) => {
  const maskedInfo = value?.trim();
  if (!maskedInfo) return null;

  if (/\d{5,}/.test(maskedInfo) && !/[•*xX]/.test(maskedInfo)) {
    throw new SalesServiceError('Payment account information must be masked', 400);
  }

  return maskedInfo;
};

const normalizeType = (type: unknown): PaymentMethodType => {
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : '';

  if (!allowedTypes.includes(normalizedType as PaymentMethodType)) {
    throw new SalesServiceError('Invalid payment method type', 400);
  }

  return normalizedType as PaymentMethodType;
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
  if (type === 'BANK' && input.bankName?.trim()) return `Tài khoản ${input.bankName.trim()}`;
  if (type === 'BANK') return 'Tài khoản ngân hàng';
  return type;
};

const getMaskedInfo = (input: CreatePaymentMethodInput, type: PaymentMethodType) => {
  const maskedInfo = normalizeMaskedInfo(input.maskedInfo);
  if (maskedInfo) return maskedInfo;
  if (type === 'VNPAY' && input.bankCode?.trim()) return `Bank ${input.bankCode.trim().toUpperCase()}`;
  return null;
};

const getInitialStatus = (type: PaymentMethodType): PaymentMethodStatus => {
  if (type === 'BANK') return 'pending';
  return 'verified';
};

const unsetDefaultPaymentMethods = (userId: string) =>
  PaymentMethod.updateMany(
    {
      user_id: toObjectId(userId, 'userId'),
      status: { $in: DEFAULTABLE_STATUSES },
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
  const initialStatus = getInitialStatus(type);
  const canBeDefault = DEFAULTABLE_STATUSES.includes(initialStatus);
  const existingDefaultableCount = await PaymentMethod.countDocuments({
    user_id: toObjectId(userId, 'userId'),
    status: { $in: DEFAULTABLE_STATUSES },
  });
  const isDefault = canBeDefault && (Boolean(input.isDefault) || existingDefaultableCount === 0);

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
    status: initialStatus,
    isDefault,
    metadata: sanitizeMetadata(input.metadata),
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

  if (input.status !== undefined) {
    throw new SalesServiceError('Payment method status can only be updated by admin', 403);
  }

  if (input.isDefault === true) {
    if (!DEFAULTABLE_STATUSES.includes(method.status)) {
      throw new SalesServiceError('Only verified payment methods can be default', 400);
    }

    await unsetDefaultPaymentMethods(userId);
  }

  if (input.displayName !== undefined) method.displayName = input.displayName.trim();
  if (input.maskedInfo !== undefined) method.maskedInfo = normalizeMaskedInfo(input.maskedInfo);
  if (input.bankCode !== undefined) method.bankCode = input.bankCode?.trim().toUpperCase() || null;
  if (input.bankName !== undefined) method.bankName = input.bankName?.trim() || null;
  if (input.metadata !== undefined) method.metadata = sanitizeMetadata(input.metadata);
  if (input.isDefault !== undefined) method.isDefault = Boolean(input.isDefault);

  if (!DEFAULTABLE_STATUSES.includes(method.status)) {
    method.isDefault = false;
  }

  return method.save();
};

const setDefaultPaymentMethod = async (userId: string, id: string) => {
  const method = await getOwnedPaymentMethod(userId, id);

  if (!DEFAULTABLE_STATUSES.includes(method.status)) {
    throw new SalesServiceError('Only verified payment methods can be default', 400);
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
  if (!DEFAULTABLE_STATUSES.includes(status)) {
    method.isDefault = false;
  }

  if (DEFAULTABLE_STATUSES.includes(status)) {
    const activeDefault = await PaymentMethod.findOne({
      _id: { $ne: method._id },
      user_id: method.user_id,
      status: { $in: DEFAULTABLE_STATUSES },
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

  if (!CHECKOUT_USABLE_STATUSES.includes(method.status)) {
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
