import type { OrderPaymentMethod, OrderStatus } from '../../database/models';

export interface ShippingAddressInput {
  customerName: string;
  province: string;
  district: string;
  ward: string;
  streetName: string;
  phoneNumber: string;
}

export interface CreateOrderInput {
  cartItemIds: string[];
  shippingAddress: ShippingAddressInput;
  paymentMethod: OrderPaymentMethod;
  couponCode?: string;
  orderNote?: string;
}

export interface PreviewCheckoutInput {
  cartItemIds: string[];
  paymentMethod?: OrderPaymentMethod;
  couponCode?: string;
}

export interface OrderListQueryInput {
  status?: OrderStatus;
  paymentMethod?: OrderPaymentMethod;
  keyword?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
}

export interface UpdateOrderShippingInput {
  provider?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  estimatedDeliveryDate?: Date | null;
}
