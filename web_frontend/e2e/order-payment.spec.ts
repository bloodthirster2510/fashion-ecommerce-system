import { expect, test } from '@playwright/test'
import {
  getVNPayReconcileNotice,
  getVNPayRefundNotice,
} from '../src/features/admin/modules/orders/utils/vnpayReconcile'

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
