import type { CustomerOrder } from '../orderApi';
import { getOrderDisplayState } from '../orderPresentation';

const createOrder = (overrides: Partial<CustomerOrder> = {}): CustomerOrder => ({
  _id: 'order-id',
  orderCode: 'FSMR-TEST',
  order_list: [],
  subTotal: 100000,
  shippingFee: 0,
  couponDiscountAmount: 0,
  shippingDiscountAmount: 0,
  membershipDiscountAmount: 0,
  taxAmount: 0,
  totalAmount: 100000,
  status: 'delivered',
  paymentMethod: 'COD',
  paymentStatus: 'paid',
  shippingAddress: {
    customerName: 'Khách hàng',
    province: 'Hồ Chí Minh',
    ward: 'Phường 1',
    wardCode: '1',
    streetName: 'Đường test',
    phoneNumber: '0900000000',
  },
  createdAt: '2026-07-14T08:00:00.000Z',
  updatedAt: '2026-07-14T09:00:00.000Z',
  deliveredAt: '2026-07-14T09:00:00.000Z',
  ...overrides,
});

describe('order presentation', () => {
  it('prioritizes a rejected return over the delivered success state', () => {
    const state = getOrderDisplayState(createOrder({
      returnRequest: {
        reason: 'Sản phẩm không phù hợp',
        status: 'rejected',
        previousOrderStatus: 'delivered',
        requestedAt: '2026-07-14T09:30:00.000Z',
        reviewReason: 'Minh chứng chưa hợp lệ',
      },
    }));

    expect(state.label).toBe('Trả hàng bị từ chối');
    expect(state.tone).toBe('danger');
    expect(state.requiresUserAction).toBe(false);
    expect(state.description).toContain('Đơn vẫn ở trạng thái đã giao');
  });

  it('keeps the normal delivered state when there is no rejected return', () => {
    const state = getOrderDisplayState(createOrder());

    expect(state.label).toBe('Đã giao tới bạn');
    expect(state.tone).toBe('success');
    expect(state.requiresUserAction).toBe(true);
  });

  it('explains that a completed order remains completed after return rejection', () => {
    const state = getOrderDisplayState(createOrder({
      status: 'completed',
      returnRequest: {
        reason: 'Sản phẩm không phù hợp',
        status: 'rejected',
        previousOrderStatus: 'completed',
        requestedAt: '2026-07-14T09:30:00.000Z',
      },
    }));

    expect(state.label).toBe('Trả hàng bị từ chối');
    expect(state.description).toContain('Đơn đã hoàn tất');
  });
});
