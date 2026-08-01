import type { OrderPaymentMethod, OrderPaymentStatus, OrderStatus } from '../../database/models';
import type { OrderQueueKey, OrderShippingWebhookStatus } from './order.constants';

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
  ghnMappingConfidence?: 'exact' | 'manual' | 'legacy' | null;
  ghnMappingVerifiedAt?: Date | string | null;
}

export interface CreateOrderInput {
  idempotencyKey?: string;
  cartItemIds: string[];
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  quoteVersion: string;
  paymentMethod: OrderPaymentMethod;
  couponCode?: string;
  couponCodes?: string[];
  orderNote?: string;
}

export interface PreviewCheckoutInput {
  cartItemIds: string[];
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  paymentMethod?: OrderPaymentMethod;
  couponCode?: string;
  couponCodes?: string[];
}

export type OrderListSort =
  | 'created_desc'
  | 'created_asc'
  | 'total_desc'
  | 'total_asc'
  | 'payment_deadline_asc';

export interface OrderListQueryInput {
  queue?: OrderQueueKey;
  status?: OrderStatus;
  statuses?: OrderStatus[];
  paymentMethod?: OrderPaymentMethod;
  paymentMethods?: OrderPaymentMethod[];
  paymentStatus?: OrderPaymentStatus;
  paymentStatuses?: OrderPaymentStatus[];
  keyword?: string;
  from?: Date;
  to?: Date;
  paymentDeadlineBefore?: Date;
  shippingFallback?: boolean;
  sort?: OrderListSort;
  page?: number;
  limit?: number;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  reason?: string;
}

export interface BulkUpdateOrderStatusInput {
  orderIds: string[];
  status: OrderStatus;
  reason: string;
}

export type BulkOrderGhnAction = 'create' | 'sync';

export interface BulkOrderGhnInput {
  orderIds: string[];
  action: BulkOrderGhnAction;
  reason: string;
}

export interface AdjustOrderPaymentStatusInput {
  paymentStatus: OrderPaymentStatus;
  reason: string;
  actorId: string;
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

export interface UpdateOrderGhnMappingInput {
  ghnProvinceId: number;
  ghnDistrictId: number;
  ghnWardCode: string;
  confidence?: 'exact' | 'manual' | 'legacy';
  note?: string;
  applyToFutureAddresses?: boolean;
}

export type SimulatedShippingWebhookStatus = OrderShippingWebhookStatus;

export interface SimulatedShippingWebhookInput {
  orderId?: string;
  orderCode?: string;
  trackingCode?: string;
  status: SimulatedShippingWebhookStatus;
  reason?: string;
  provider?: string | null;
  deliveredAt?: Date | null;
  rawPayload?: Record<string, unknown> | null;
}
