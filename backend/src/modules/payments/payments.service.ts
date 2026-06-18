import crypto from 'crypto';
import {
  buildVNPayQueryString,
  createVNPaySecureHash,
  formatVNPayDate,
  normalizeVNPayParams,
  sanitizeVNPayOrderInfo,
} from '../../utils/vnpay.util';

type VNPayCreatePaymentUrlInput = {
  orderId: string;
  amount: number;
  ipAddr: string;
  bankCode?: string;
  locale?: string;
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const buildApiCallbackUrl = (baseUrl: string, path: string) =>
  `${trimTrailingSlashes(baseUrl)}${path}`;

const timingSafeHexEqual = (left?: string, right?: string) => {
  if (!left || !right || !/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getVNPayReturnUrl = () => {
  const publicBaseUrl =
    process.env.VNPAY_PUBLIC_BASE_URL?.trim() ||
    process.env.PUBLIC_API_BASE_URL?.trim();

  if (publicBaseUrl) {
    return buildApiCallbackUrl(publicBaseUrl, '/api/payments/vnpay/return');
  }

  return process.env.VNPAY_RETURN_URL?.trim();
};

export const createVNPayPaymentUrl = ({
  orderId,
  amount,
  ipAddr,
  bankCode,
  locale = 'vn',
}: VNPayCreatePaymentUrlInput) => {
  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const secretKey = process.env.VNPAY_HASH_SECRET?.trim();
  const vnpUrl = process.env.VNPAY_PAY_URL?.trim() || process.env.VNPAY_API_URL?.trim();
  const returnUrl = getVNPayReturnUrl();

  if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
    throw new Error('Missing VNPay configuration');
  }

  const now = new Date();
  const createDate = formatVNPayDate(now);
  const expireDate = formatVNPayDate(new Date(now.getTime() + 15 * 60 * 1000));

  // Chỉ đưa các trường VNPay hỗ trợ vào payload ký; thêm metadata nội bộ ở đây sẽ làm sai chữ ký.
  let vnpParams: Record<string, unknown> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale === 'en' ? 'en' : 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: sanitizeVNPayOrderInfo(`Thanh toán đơn hàng ${orderId}`),
    vnp_OrderType: 'other',
    // VNPay yêu cầu số tiền ở đơn vị nhỏ nhất, nên tiền VND phải nhân 100 trước khi ký.
    vnp_Amount: String(Math.round(amount * 100)),
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  };

  if (bankCode) {
    vnpParams.vnp_BankCode = bankCode;
  }

  // Chữ ký phải được tạo trước khi gắn vnp_SecureHash vào query string.
  const secureHash = createVNPaySecureHash(vnpParams, secretKey);

  vnpParams.vnp_SecureHash = secureHash;

  const paymentUrl = `${vnpUrl}?${buildVNPayQueryString(vnpParams)}`;

  return paymentUrl;
};

export const verifyVNPayResponse = (params: Record<string, unknown>) => {
  const secretKey = process.env.VNPAY_HASH_SECRET;

  if (!secretKey) {
    throw new Error('Missing VNPay configuration');
  }

  const normalizedParams = normalizeVNPayParams(params);
  const receivedHash = normalizedParams.vnp_SecureHash;

  // Khi kiểm tra callback, VNPay không tính các trường hash vào dữ liệu dùng để tạo lại chữ ký.
  delete normalizedParams.vnp_SecureHash;
  delete normalizedParams.vnp_SecureHashType;

  const expectedHash = createVNPaySecureHash(normalizedParams, secretKey);
  const responseCode = normalizedParams.vnp_ResponseCode;
  const transactionStatus = normalizedParams.vnp_TransactionStatus;

  const amount = normalizedParams.vnp_Amount !== undefined
    ? Number(normalizedParams.vnp_Amount) / 100
    : undefined;

  return {
    isValidSignature: timingSafeHexEqual(receivedHash, expectedHash),
    isSuccess: responseCode === '00' && transactionStatus === '00',
    orderId: normalizedParams.vnp_TxnRef,
    amount,
    responseCode,
    transactionStatus,
    transactionNo: normalizedParams.vnp_TransactionNo,
    bankCode: normalizedParams.vnp_BankCode,
    payDate: normalizedParams.vnp_PayDate,
  };
};
