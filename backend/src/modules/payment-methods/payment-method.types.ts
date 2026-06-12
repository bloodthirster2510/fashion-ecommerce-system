import type { PaymentMethodStatus, PaymentMethodType } from '../../database/models';

export type CreatePaymentMethodInput = {
  type: PaymentMethodType;
  provider?: string;
  displayName?: string;
  maskedInfo?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdatePaymentMethodInput = {
  displayName?: string;
  maskedInfo?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  status?: PaymentMethodStatus;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
};
