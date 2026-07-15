import crypto from 'crypto';
import axios from 'axios';
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

type VNPayTransactionQueryInput = {
  txnRef: string;
  transactionDate: string;
  transactionNo?: string | null;
  ipAddr: string;
};

type VNPayRefundInput = VNPayTransactionQueryInput & {
  amount: number;
  createdBy: string;
  transactionType?: '02' | '03';
};

type VNPayApiResponse = {
  isValidSignature: boolean;
  vnp_SecureHash?: string;
  vnp_ResponseId?: string;
  vnp_Command?: string;
  vnp_ResponseCode?: string;
  vnp_Message?: string;
  vnp_TmnCode?: string;
  vnp_TxnRef?: string;
  vnp_Amount?: string;
  vnp_BankCode?: string;
  vnp_PayDate?: string;
  vnp_TransactionNo?: string;
  vnp_TransactionType?: string;
  vnp_TransactionStatus?: string;
  vnp_OrderInfo?: string;
  vnp_PromotionCode?: string;
  vnp_PromotionAmount?: string;
  [key: string]: string | boolean | undefined;
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

const createVNPayPipeHash = (values: unknown[], secretKey: string) => crypto
  .createHmac('sha512', secretKey)
  .update(values.map((value) => String(value ?? '')).join('|'), 'utf8')
  .digest('hex');

const normalizeVNPayApiResponse = (value: unknown) => normalizeVNPayParams(
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {},
);

const getVNPayTransactionApiConfig = () => {
  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const secretKey = process.env.VNPAY_HASH_SECRET?.trim();
  let apiUrl = process.env.VNPAY_TRANSACTION_API_URL?.trim();

  if (!apiUrl && process.env.VNPAY_PAY_URL?.includes('sandbox.vnpayment.vn')) {
    apiUrl = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
  }

  if (!tmnCode || !secretKey || !apiUrl) {
    throw new Error('Missing VNPay transaction API configuration');
  }

  return { tmnCode, secretKey, apiUrl };
};

export const getVNPayServerIp = () => {
  const serverIp = process.env.VNPAY_SERVER_IP?.trim();
  if (serverIp) return serverIp;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing VNPAY_SERVER_IP configuration');
  }
  return '127.0.0.1';
};

const postVNPayTransactionRequest = async (payload: Record<string, string>) => {
  const { apiUrl } = getVNPayTransactionApiConfig();
  const response = await axios.post(apiUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
  });

  return normalizeVNPayApiResponse(response.data);
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

export const createVNPayPaymentRequest = ({
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

  return { paymentUrl, createDate, expireDate };
};

export const createVNPayPaymentUrl = (input: VNPayCreatePaymentUrlInput) =>
  createVNPayPaymentRequest(input).paymentUrl;

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

export const queryVNPayTransaction = async ({
  txnRef,
  transactionDate,
  transactionNo,
  ipAddr,
}: VNPayTransactionQueryInput): Promise<VNPayApiResponse> => {
  const { tmnCode, secretKey } = getVNPayTransactionApiConfig();
  const requestId = crypto.randomBytes(16).toString('hex');
  const createDate = formatVNPayDate();
  const orderInfo = sanitizeVNPayOrderInfo(`Query transaction ${txnRef}`);
  const payload: Record<string, string> = {
    vnp_RequestId: requestId,
    vnp_Version: '2.1.0',
    vnp_Command: 'querydr',
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_TransactionDate: transactionDate,
    vnp_CreateDate: createDate,
    vnp_IpAddr: ipAddr,
  };

  if (transactionNo) payload.vnp_TransactionNo = transactionNo;
  payload.vnp_SecureHash = createVNPayPipeHash([
    requestId,
    '2.1.0',
    'querydr',
    tmnCode,
    txnRef,
    transactionDate,
    createDate,
    ipAddr,
    orderInfo,
  ], secretKey);

  const result = await postVNPayTransactionRequest(payload);
  const expectedHash = createVNPayPipeHash([
    result.vnp_ResponseId,
    result.vnp_Command,
    result.vnp_ResponseCode,
    result.vnp_Message,
    result.vnp_TmnCode,
    result.vnp_TxnRef,
    result.vnp_Amount,
    result.vnp_BankCode,
    result.vnp_PayDate,
    result.vnp_TransactionNo,
    result.vnp_TransactionType,
    result.vnp_TransactionStatus,
    result.vnp_OrderInfo,
    result.vnp_PromotionCode,
    result.vnp_PromotionAmount,
  ], secretKey);

  return {
    ...result,
    isValidSignature: timingSafeHexEqual(result.vnp_SecureHash, expectedHash),
  } as VNPayApiResponse;
};

export const refundVNPayTransaction = async ({
  txnRef,
  transactionDate,
  transactionNo,
  amount,
  createdBy,
  ipAddr,
  transactionType = '02',
}: VNPayRefundInput): Promise<VNPayApiResponse> => {
  const { tmnCode, secretKey } = getVNPayTransactionApiConfig();
  const requestId = crypto.randomBytes(16).toString('hex');
  const createDate = formatVNPayDate();
  const orderInfo = sanitizeVNPayOrderInfo(`Refund transaction ${txnRef}`);
  const vnpAmount = String(Math.round(amount * 100));
  const payload: Record<string, string> = {
    vnp_RequestId: requestId,
    vnp_Version: '2.1.0',
    vnp_Command: 'refund',
    vnp_TmnCode: tmnCode,
    vnp_TransactionType: transactionType,
    vnp_TxnRef: txnRef,
    vnp_Amount: vnpAmount,
    vnp_TransactionDate: transactionDate,
    vnp_CreateBy: createdBy,
    vnp_CreateDate: createDate,
    vnp_IpAddr: ipAddr,
    vnp_OrderInfo: orderInfo,
  };

  if (transactionNo) payload.vnp_TransactionNo = transactionNo;
  payload.vnp_SecureHash = createVNPayPipeHash([
    requestId,
    '2.1.0',
    'refund',
    tmnCode,
    transactionType,
    txnRef,
    vnpAmount,
    transactionNo ?? '',
    transactionDate,
    createdBy,
    createDate,
    ipAddr,
    orderInfo,
  ], secretKey);

  const result = await postVNPayTransactionRequest(payload);
  const expectedHash = createVNPayPipeHash([
    result.vnp_ResponseId,
    result.vnp_Command,
    result.vnp_ResponseCode,
    result.vnp_Message,
    result.vnp_TmnCode,
    result.vnp_TxnRef,
    result.vnp_Amount,
    result.vnp_BankCode,
    result.vnp_PayDate,
    result.vnp_TransactionNo,
    result.vnp_TransactionType,
    result.vnp_TransactionStatus,
    result.vnp_OrderInfo,
  ], secretKey);

  return {
    ...result,
    isValidSignature: timingSafeHexEqual(result.vnp_SecureHash, expectedHash),
  } as VNPayApiResponse;
};
