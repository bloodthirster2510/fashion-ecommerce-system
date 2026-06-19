import { createVNPaySecureHash } from '../../../utils/vnpay.util';
import { verifyVNPayResponse } from '../payments.service';

describe('payments.service', () => {
  const previousSecret = process.env.VNPAY_HASH_SECRET;

  beforeEach(() => {
    process.env.VNPAY_HASH_SECRET = 'test-vnpay-secret';
  });

  afterAll(() => {
    process.env.VNPAY_HASH_SECRET = previousSecret;
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
});
