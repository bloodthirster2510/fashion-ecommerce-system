import type { OrderPaymentMethod, OrderPaymentStatus, OrderStatus } from '../../database/models';

export interface ShippingAddressInput {
  customerName: string;
  province: string;
  provinceCode?: string | null;
  provinceId?: number | null;
  district?: string | null;
  districtId?: number | null;
  ward: string;
  wardCode: string;
  streetName: string;
  phoneNumber: string;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual';
}

export interface CreateOrderInput {
  cartItemIds: string[];
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  quoteVersion?: string;
  paymentMethod: OrderPaymentMethod;
  paymentMethodId?: string;
  couponCode?: string;
  orderNote?: string;
}

export interface PreviewCheckoutInput {
  cartItemIds: string[];
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  paymentMethod?: OrderPaymentMethod;
  couponCode?: string;
}

export interface OrderListQueryInput {
  status?: OrderStatus;
  statuses?: OrderStatus[];
  paymentMethod?: OrderPaymentMethod;
  paymentStatus?: OrderPaymentStatus;
  keyword?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  reason?: string;
}

export interface OrderEvidenceImageInput {
  imageBase64: string;
  mimeType?: string;
}

export interface CancelOrderInput {
  reason?: string;
  imageUrls?: string[];
  imageAttachments?: OrderEvidenceImageInput[];
}

export interface RequestReturnInput {
  reason: string;
  imageUrls?: string[];
  imageAttachments?: OrderEvidenceImageInput[];
}

export type ReviewReturnDecision = 'approved' | 'rejected';

export interface ReviewReturnRequestInput {
  decision: ReviewReturnDecision;
  reason?: string;
}

export interface UpdateOrderShippingInput {
  provider?: string | null;
  serviceId?: number | null;
  serviceTypeId?: number | null;
  fee?: number | null;
  customerFee?: number | null;
  quotedProviderCost?: number | null;
  actualProviderCost?: number | null;
  comparisonStatus?: 'live' | 'partial' | 'fallback' | null;
  pricingMode?: 'CHEAPEST' | 'RECOMMENDED' | 'FIXED_FALLBACK' | null;
  recommendedOptionKey?: string | null;
  selectedOptionKey?: string | null;
  quoteVersion?: string | null;
  options?: Record<string, unknown>[] | null;
  status?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  estimatedDeliveryDate?: Date | null;
  rawQuote?: Record<string, unknown> | null;
  rawShipment?: Record<string, unknown> | null;
}
