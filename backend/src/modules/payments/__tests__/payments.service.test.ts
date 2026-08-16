import crypto from 'crypto';
import axios from 'axios';
import { createVNPaySecureHash } from '../../../utils/vnpay.util';
import {
  createVNPayPaymentRequest,
  queryVNPayTransaction,
  refundVNPayTransaction,
  verifyVNPayResponse,
} from '../payments.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('payments.service', () => {
  const previousSecret = process.env.VNPAY_HASH_SECRET;
  const previousTmnCode = process.env.VNPAY_TMN_CODE;
  const previousPayUrl = process.env.VNPAY_PAY_URL;
  const previousPublicBaseUrl = process.env.VNPAY_PUBLIC_BASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VNPAY_HASH_SECRET = 'test-vnpay-secret';
    process.env.VNPAY_TMN_CODE = 'TESTV210';
    process.env.VNPAY_PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    process.env.VNPAY_TRANSACTION_API_URL = 'https://sandbox.example/transaction';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.VNPAY_HASH_SECRET;
    else process.env.VNPAY_HASH_SECRET = previousSecret;
    if (previousTmnCode === undefined) delete process.env.VNPAY_TMN_CODE;
    else process.env.VNPAY_TMN_CODE = previousTmnCode;
    if (previousPayUrl === undefined) delete process.env.VNPAY_PAY_URL;
    else process.env.VNPAY_PAY_URL = previousPayUrl;
    if (previousPublicBaseUrl === undefined) delete process.env.VNPAY_PUBLIC_BASE_URL;
    else process.env.VNPAY_PUBLIC_BASE_URL = previousPublicBaseUrl;
  });

  it('uses the mobile callback route for payment links created by the app', () => {
    process.env.VNPAY_PUBLIC_BASE_URL = 'https://api.example.com';

    const result = createVNPayPaymentRequest({
      orderId: 'FSORDERA1',
      amount: 385000,
      ipAddr: '127.0.0.1',
      client: 'mobile',
    });
    const paymentUrl = new URL(result.paymentUrl);

    expect(paymentUrl.searchParams.get('vnp_ReturnUrl')).toBe(
      'https://api.example.com/api/payments/vnpay/return/mobile',
    );
  });

  it('verifies VNPay callbacks with a timing-safe hash comparison', () => {
    const params = {
      vnp_TxnRef: 'FSORDERA1',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '38500000',
    };
    const secureHash = createVNPaySecureHash(params, process.env.VNPAY_HASH_SECRET!);

    const result = verifyVNPayResponse({
      ...params,
      vnp_SecureHash: secureHash,
    });

    expect(result).toMatchObject({
      isValidSignature: true,
      isSuccess: true,
      orderId: 'FSORDERA1',
      amount: 385000,
    });
  });

  it('rejects missing or malformed VNPay secure hashes', () => {
    const result = verifyVNPayResponse({
      vnp_TxnRef: 'FSORDERA1',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '38500000',
      vnp_SecureHash: 'not-a-hex-hash',
    });

    expect(result.isValidSignature).toBe(false);
  });

  it('signs QueryDr requests using the documented pipe-delimited field order', async () => {
    mockedAxios.post.mockResolvedValue({ data: { vnp_SecureHash: '00' } });

    await queryVNPayTransaction({
      txnRef: 'FSORDERA1',
      transactionDate: '20260618120000',
      transactionNo: '123456',
      ipAddr: '127.0.0.1',
    });

    const payload = mockedAxios.post.mock.calls[0][1] as Record<string, string>;
    const signData = [
      payload.vnp_RequestId,
      payload.vnp_Version,
      payload.vnp_Command,
      payload.vnp_TmnCode,
      payload.vnp_TxnRef,
      payload.vnp_TransactionDate,
      payload.vnp_CreateDate,
      payload.vnp_IpAddr,
      payload.vnp_OrderInfo,
    ].join('|');
    const expectedHash = crypto
      .createHmac('sha512', process.env.VNPAY_HASH_SECRET!)
      .update(signData, 'utf8')
      .digest('hex');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://sandbox.example/transaction',
      expect.objectContaining({
        vnp_Command: 'querydr',
        vnp_TxnRef: 'FSORDERA1',
        vnp_TransactionNo: '123456',
        vnp_SecureHash: expectedHash,
      }),
      expect.objectContaining({ timeout: 15000 }),
    );
  });

  it('sends full VNPay refunds in gateway minor units with a signed request', async () => {
    mockedAxios.post.mockResolvedValue({ data: { vnp_SecureHash: '00' } });

    await refundVNPayTransaction({
      txnRef: 'FSORDERA1',
      transactionDate: '20260618120000',
      transactionNo: '123456',
      amount: 385000,
      createdBy: '665000000000000000000001',
      ipAddr: '127.0.0.1',
    });

    const payload = mockedAxios.post.mock.calls[0][1] as Record<string, string>;
    const signData = [
      payload.vnp_RequestId,
      payload.vnp_Version,
      payload.vnp_Command,
      payload.vnp_TmnCode,
      payload.vnp_TransactionType,
      payload.vnp_TxnRef,
      payload.vnp_Amount,
      payload.vnp_TransactionNo,
      payload.vnp_TransactionDate,
      payload.vnp_CreateBy,
      payload.vnp_CreateDate,
      payload.vnp_IpAddr,
      payload.vnp_OrderInfo,
    ].join('|');
    const expectedHash = crypto
      .createHmac('sha512', process.env.VNPAY_HASH_SECRET!)
      .update(signData, 'utf8')
      .digest('hex');

    expect(payload).toEqual(expect.objectContaining({
      vnp_Command: 'refund',
      vnp_TransactionType: '02',
      vnp_Amount: '38500000',
      vnp_SecureHash: expectedHash,
    }));
  });
});
