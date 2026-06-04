import { Request, Response } from "express";
import { error, ok, serverError } from '../../utils/response';
import {
  createVNPayPaymentUrl,
  verifyVNPayResponse,
} from './payments.service';

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

    // VNPay đưa IP khách hàng vào dữ liệu ký thanh toán; nếu đi qua proxy thì lấy IP đầu tiên trong x-forwarded-for.
    const rawIpAddr =
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const ipAddr = normalizeClientIp(rawIpAddr);

    const paymentUrl = createVNPayPaymentUrl({
      orderId: transactionRef,
      amount: parsedAmount,
      ipAddr,
      bankCode: bankCode ? String(bankCode) : undefined,
      locale: locale ? String(locale) : undefined,
    });

    return ok(res, { paymentUrl }, 'Created VNPay payment URL');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const handleVNPayReturn = (req: Request, res: Response) => {
  try {
    // Return URL là luồng quay về trình duyệt, nên trả dữ liệu đã xác thực để frontend hiển thị trạng thái thanh toán.
    const result = verifyVNPayResponse(req.query);
    return ok(res, result, 'Verified VNPay return');
  } catch (err: unknown) {
    return serverError(res, getErrorMessage(err));
  }
};

export const handleVNPayIpn = (req: Request, res: Response) => {
  try {
    const result = verifyVNPayResponse(req.query);

    // IPN của VNPay luôn cần HTTP 200; VNPay dựa vào RspCode để biết có cần gửi lại thông báo hay không.
    if (!result.isValidSignature) {
      return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }

    if (!result.isSuccess) {
      return res.status(200).json({ RspCode: '00', Message: 'Confirm failed payment' });
    }

    return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
  } catch (err: unknown) {
    return res.status(200).json({ RspCode: '99', Message: getErrorMessage(err) });
  }
};
