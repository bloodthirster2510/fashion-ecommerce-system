import { Request, Response } from 'express';
import { error, ok, serverError } from '../../utils/response';
import {
  createVNPayPaymentUrl,
  verifyVNPayResponse,
} from './payments.service';
import { transactionService } from './transaction.service';
import { Order, type OrderPaymentStatus } from '../../database/models';
import { Types } from 'mongoose';

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Internal Server Error';

const normalizeClientIp = (ip?: string) => {
  if (!ip || ip === '::1') {
    return '127.0.0.1';
  }

  const normalizedIp = ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  return ipv4Regex.test(normalizedIp) ? normalizedIp : '127.0.0.1';
};

const isValidVNPayTransactionRef = (orderId: string) => /^[A-Za-z0-9]{1,100}$/.test(orderId);

const getClientIp = (req: Request) => {
  const rawIpAddr =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';
  return normalizeClientIp(rawIpAddr);
};

// ---------------------------------------------------------------------------
// [Legacy] Dùng để test sandbox trực tiếp — KHÔNG dùng trong luồng checkout thật
// ---------------------------------------------------------------------------
export const createVNPayUrl = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, bankCode, locale } = req.body;
    const transactionRef = String(orderId || '');
    const parsedAmount = Number(amount);

    if (!transactionRef || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return error(res, 'orderId and a positive amount are required');
    }

    if (!isValidVNPayTransactionRef(transactionRef)) {
      return error(res, 'orderId chỉ được gồm chữ và số, tối đa 100 ký tự theo định dạng vnp_TxnRef của VNPay');
    }

    const paymentUrl = createVNPayPaymentUrl({
      orderId: transactionRef,
      amount: parsedAmount,
      ipAddr: getClientIp(req),
      bankCode: bankCode ? String(bankCode) : undefined,
      locale: locale ? String(locale) : undefined,
    });

    return ok(res, { paymentUrl }, 'Created VNPay payment URL');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

// ---------------------------------------------------------------------------
// [Secure] Tạo URL thanh toán VNPay từ Order thật — dùng trong checkout mobile
// ---------------------------------------------------------------------------
export const createVNPayUrlFromOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orderId = req.params.orderId as string;
    const { bankCode, locale } = req.body as { bankCode?: string; locale?: string };

    if (!Types.ObjectId.isValid(orderId)) {
      return error(res, 'orderId không hợp lệ', 400);
    }

    // Lấy và xác thực Order
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    if (order.user_id.toString() !== userId) {
      return error(res, 'Không tìm thấy đơn hàng', 404);
    }

    if (order.paymentMethod !== 'VNPAY') {
      return error(res, 'Đơn hàng này không sử dụng phương thức thanh toán VNPay', 400);
    }

    if (order.paymentStatus === 'paid') {
      return error(res, 'Đơn hàng đã được thanh toán', 409);
    }

    if (order.status === 'cancelled') {
      return error(res, 'Đơn hàng đã bị huỷ', 400);
    }

    // Tìm hoặc tạo Transaction pending cho order này
    let transaction = await transactionService.findPendingByOrderId(orderId);

    if (!transaction) {
      transaction = await transactionService.createPendingTransaction({
        userId,
        orderId,
        amount: order.totalAmount,
        paymentMethod: 'VNPAY',
        gatewayProvider: 'vnpay',
      });
    }

    // Dùng orderCode làm vnp_TxnRef — chữ/số, ngắn, duy nhất
    const txnRef = order.orderCode;
    if (!isValidVNPayTransactionRef(txnRef)) {
      return error(res, `orderCode "${txnRef}" không hợp lệ để dùng làm vnp_TxnRef`, 500);
    }

    const paymentUrl = createVNPayPaymentUrl({
      orderId: txnRef,
      amount: order.totalAmount,
      ipAddr: getClientIp(req),
      bankCode: bankCode || undefined,
      locale: locale || 'vn',
    });

    return ok(res, {
      paymentUrl,
      transactionId: transaction._id.toString(),
      orderCode: order.orderCode,
      amount: order.totalAmount,
    }, 'Created VNPay payment URL from order');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

// ---------------------------------------------------------------------------
// Return URL — VNPay redirect về sau khi người dùng thanh toán trên browser
// ---------------------------------------------------------------------------
export const handleVNPayReturn = (req: Request, res: Response) => {
  try {
    const result = verifyVNPayResponse(req.query);
    return ok(res, result, 'Verified VNPay return');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

// ---------------------------------------------------------------------------
// IPN — VNPay gọi server-to-server để xác nhận kết quả thanh toán
// Luôn trả HTTP 200; dùng RspCode để báo kết quả xử lý cho VNPay.
// PHẢI đảm bảo idempotent: cùng 1 giao dịch gọi nhiều lần vẫn an toàn.
// ---------------------------------------------------------------------------
export const handleVNPayIpn = async (req: Request, res: Response) => {
  try {
    const result = verifyVNPayResponse(req.query);

    if (!result.isValidSignature) {
      return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }

    // Tìm order theo orderCode (vnp_TxnRef)
    const orderCode = String(result.orderId || '');
    if (!orderCode) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    const order = await Order.findOne({ orderCode }).lean();
    if (!order) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    // Tìm transaction pending mới nhất của order này
    const transaction = await transactionService.findPendingByOrderId(order._id.toString());

    if (!transaction) {
      // Không có transaction pending → kiểm tra xem đã thành công trước đó chưa (idempotent)
      const latest = await transactionService.findLatestByOrderId(order._id.toString());
      if (latest?.status === 'success') {
        // Đã xử lý thành công trước rồi — trả đã xử lý, không làm gì thêm
        return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
      }
      return res.status(200).json({ RspCode: '01', Message: 'Transaction not found' });
    }

    // Kiểm tra số tiền callback khớp với giao dịch trong DB (tránh gian lận)
    const callbackAmount = result.amount;
    if (callbackAmount !== undefined && Math.round(callbackAmount) !== Math.round(transaction.amount)) {
      return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
    }

    const isSuccess = result.isSuccess;
    const newStatus = isSuccess ? 'success' : 'failed';

    // Cập nhật Transaction
    await transactionService.resolveTransaction({
      transactionId: transaction._id.toString(),
      status: newStatus,
      gatewayTransactionId: result.transactionNo ? String(result.transactionNo) : null,
      paymentDetail: {
        vnp_ResponseCode: result.responseCode,
        vnp_TransactionStatus: result.transactionStatus,
        vnp_TransactionNo: result.transactionNo,
        vnp_BankCode: result.bankCode,
        vnp_PayDate: result.payDate,
        vnp_Amount: callbackAmount,
      },
    });

    // Cập nhật paymentStatus của Order
    const newPaymentStatus: OrderPaymentStatus = isSuccess ? 'paid' : 'failed';
    await Order.updateOne(
      { _id: order._id },
      { $set: { paymentStatus: newPaymentStatus } },
    );

    return res.status(200).json({ RspCode: '00', Message: isSuccess ? 'Confirm success' : 'Confirm failed payment' });
  } catch (err: unknown) {
    return res.status(200).json({ RspCode: '99', Message: getErrorMessage(err) });
  }
};
