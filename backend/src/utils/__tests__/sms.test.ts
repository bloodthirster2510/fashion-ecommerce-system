import crypto from 'crypto';
import * as sms from '../sms';

describe('sms otp utilities', () => {
  const originalOtpSecret = process.env.OTP_HASH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.OTP_HASH_SECRET = 'test-otp-secret';
    process.env.NODE_ENV = 'test';
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.OTP_HASH_SECRET = originalOtpSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  const mockRandomInt = (value: number) => {
    const randomInt = jest.spyOn(crypto, 'randomInt') as unknown as jest.Mock;
    randomInt.mockReturnValue(value);
    return randomInt;
  };

  it('generates a six digit OTP with crypto.randomInt', () => {
    const randomInt = mockRandomInt(123456);

    expect(sms.generateOtp()).toBe('123456');
    expect(randomInt).toHaveBeenCalledWith(100000, 1000000);
  });

  it('verifies OTP once and stores a single-use verification token', async () => {
    mockRandomInt(654321);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await sms.sendOtpSms('0900000001');
    const token = sms.verifyOtpCode('0900000001', '654321');

    expect(token).toEqual(expect.any(String));
    expect(sms.verifyOtpToken('0900000001', token!)).toBe(true);
    expect(sms.verifyOtpToken('0900000001', token!)).toBe(false);
  });

  it('locks OTP verification after too many wrong attempts', async () => {
    mockRandomInt(111111);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await sms.sendOtpSms('0900000002');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(sms.verifyOtpCode('0900000002', '222222')).toBeNull();
    }

    expect(sms.verifyOtpCode('0900000002', '111111')).toBeNull();
  });
});
