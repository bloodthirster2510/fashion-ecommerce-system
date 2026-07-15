import { expect, test } from '@playwright/test'
import {
  getVNPayReconcileNotice,
  getVNPayRefundNotice,
} from '../src/features/admin/modules/orders/utils/vnpayReconcile'
import type { AdminOrder } from '../src/features/admin/modules/orders/orderAdminApi'
import { resolveInitialTabKey } from '../src/features/admin/modules/orders/orderPresentation'
import { getOrderQueue } from '../src/features/admin/modules/orders/utils/orderQueue'

const pendingVNPayOrder = {
  status: 'confirmed',
  paymentMethod: 'VNPAY',
  paymentStatus: 'pending',
} as AdminOrder

test('pending VNPay orders stay visible in the payment queue', () => {
  expect(getOrderQueue(pendingVNPayOrder)).toBe('blocked')
})

test('online order operations open the payment queue by default', () => {
  expect(resolveInitialTabKey(undefined, true, 'online')).toBe('blocked')
})

test('VNPay refund request stays a warning while the gateway is processing it', () => {
  expect(getVNPayRefundNotice('pending')).toEqual({
    type: 'warning',
    message: 'Yêu cầu hoàn tiền đã gửi VNPay, đang chờ đối soát',
  })
})

test('VNPay reconciliation keeps a pending refund visibly unresolved', () => {
  const notice = getVNPayReconcileNotice({
    gateway: {
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '01',
    },
    reconciliationStatus: 'pending_refund',
  })

  expect(notice).toEqual({
    type: 'warning',
    message: 'Thanh toán gốc đã thành công; yêu cầu hoàn tiền vẫn đang chờ VNPay xử lý. Đơn chưa được chuyển sang đã hoàn tiền.',
  })
})

test('VNPay reconciliation confirms a completed full refund explicitly', () => {
  const notice = getVNPayReconcileNotice({
    gateway: {
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '02',
    },
    reconciliationStatus: 'refunded',
  })

  expect(notice).toEqual({
    type: 'success',
    message: 'VNPay đã xác nhận hoàn tiền toàn phần và đơn đã được cập nhật.',
  })
})
