import type { AdminTransaction, VNPayReconcileResponse, VNPayRefundResponse } from '../orderAdminApi'
import type { Notice } from '../orderTypes'

type ReconcileNoticeInput = Pick<VNPayReconcileResponse, 'gateway' | 'reconciliationStatus'>

export type VNPayRefundDisplayStatus = 'not_requested' | 'pending' | 'completed' | 'failed'

export const getLatestVNPayRefundTransaction = (transactions: AdminTransaction[]) =>
  transactions.find((transaction) => transaction.paymentDetail?.vnp_Command === 'refund') ?? null

export const getVNPayRefundDisplayStatus = (
  transaction?: AdminTransaction | null,
): VNPayRefundDisplayStatus => {
  if (!transaction) return 'not_requested'
  if (transaction.status === 'success') return 'completed'
  if (transaction.status === 'pending') return 'pending'
  return 'failed'
}

export const getTransactionStatusLabel = (transaction: AdminTransaction) => {
  if (transaction.paymentDetail?.vnp_Command !== 'refund') return null
  if (transaction.status === 'success') return 'Đã hoàn tiền'
  if (transaction.status === 'pending') return 'VNPay đang xử lý'
  return 'Hoàn tiền thất bại'
}

export const getVNPayRefundNotice = (
  refundStatus: VNPayRefundResponse['refundStatus'],
): Pick<Notice, 'type' | 'message'> => {
  if (refundStatus === 'completed') {
    return { type: 'success', message: 'VNPay đã xác nhận hoàn tiền' }
  }

  if (refundStatus === 'pending') {
    return { type: 'warning', message: 'Yêu cầu hoàn tiền đã gửi VNPay, đang chờ đối soát' }
  }

  return { type: 'error', message: 'VNPay từ chối yêu cầu hoàn tiền' }
}

export const getVNPayReconcileNotice = ({
  gateway,
  reconciliationStatus,
}: ReconcileNoticeInput): Pick<Notice, 'type' | 'message'> => {
  if (gateway.vnp_ResponseCode === '94') {
    return {
      type: 'warning',
      message: 'VNPay báo yêu cầu đối soát bị trùng. Không có trạng thái tiền nào bị thay đổi; hãy đợi rồi thử lại.',
    }
  }

  if (reconciliationStatus === 'pending_refund') {
    return {
      type: 'warning',
      message: 'Thanh toán gốc đã thành công; yêu cầu hoàn tiền vẫn đang chờ VNPay xử lý. Đơn chưa được chuyển sang đã hoàn tiền.',
    }
  }

  if (reconciliationStatus === 'refunded') {
    return {
      type: 'success',
      message: 'VNPay đã xác nhận hoàn tiền toàn phần và đơn đã được cập nhật.',
    }
  }

  if (reconciliationStatus === 'paid') {
    return {
      type: 'success',
      message: 'VNPay đã xác nhận thanh toán thành công và đơn đã được cập nhật.',
    }
  }

  const gatewayStatus = String(gateway.vnp_TransactionStatus ?? '')
  return gatewayStatus === '00'
    ? {
        type: 'success',
        message: 'Đã đối soát VNPay; trạng thái đơn không thay đổi.',
      }
    : {
        type: 'error',
        message: `VNPay trả về trạng thái ${gatewayStatus || 'không xác định'}`,
      }
}
