import crypto from 'crypto';
import * as sms from '../sms';
import { OtpVerification } from '../../database/models/otp-verification.model';

jest.mock('../../database/models/otp-verification.model', () => ({
  OtpVerification: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    deleteOne: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

const mockedOtpVerification = OtpVerification as jest.Mocked<typeof OtpVerification>;

const mockFindOneLeanResults = (...results: unknown[]) => {
  const pendingResults = [...results];
  (mockedOtpVerification.findOne as jest.Mock).mockImplementation(() => ({
    lean: jest.fn().mockResolvedValue(pendingResults.shift() ?? null),
  }));
};

describe('sms otp utilities', () => {
  const originalOtpSecret = process.env.OTP_HASH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.OTP_HASH_SECRET = 'test-otp-secret';
    process.env.NODE_ENV = 'test';
    jest.restoreAllMocks();
    jest.clearAllMocks();
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
    const savedOtp = (mockedOtpVerification.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    mockFindOneLeanResults(
      {
        _id: 'otp-id',
        phone: '0900000001',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 0,
      },
    );
    (mockedOtpVerification.findOneAndDelete as jest.Mock)
      .mockResolvedValueOnce({
        _id: 'otp-id',
        phone: '0900000001',
      })
      .mockImplementationOnce(() => ({
        lean: jest.fn().mockResolvedValue({
          _id: 'token-id',
          phone: '0900000001',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        }),
      }))
      .mockImplementationOnce(() => ({
        lean: jest.fn().mockResolvedValue(null),
      }));

    const token = await sms.verifyOtpCode('0900000001', '654321');

    expect(token).toEqual(expect.any(String));
    expect(mockedOtpVerification.findOneAndDelete).toHaveBeenCalledWith({
      _id: 'otp-id',
      phone: '0900000001',
      kind: 'otp',
    });
    expect(mockedOtpVerification.create).toHaveBeenCalledWith(expect.objectContaining({
      phone: '0900000001',
      kind: 'token',
      tokenHash: expect.any(String),
    }));
    expect(await sms.verifyOtpToken('0900000001', token!)).toBe(true);
    expect(await sms.verifyOtpToken('0900000001', token!)).toBe(false);
  });

  it('locks OTP verification after too many wrong attempts', async () => {
    mockRandomInt(111111);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await sms.sendOtpSms('0900000002');
    const savedOtp = (mockedOtpVerification.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    mockFindOneLeanResults(
      {
        _id: 'otp-id',
        phone: '0900000002',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 0,
      },
      {
        _id: 'otp-id',
        phone: '0900000002',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 1,
      },
      {
        _id: 'otp-id',
        phone: '0900000002',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 2,
      },
      {
        _id: 'otp-id',
        phone: '0900000002',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 3,
      },
      {
        _id: 'otp-id',
        phone: '0900000002',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 4,
      },
      {
        _id: 'otp-id',
        phone: '0900000002',
        otpHash: savedOtp.otpHash,
        expiresAt: savedOtp.expiresAt,
        attempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      },
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await sms.verifyOtpCode('0900000002', '222222')).toBeNull();
    }

    expect(mockedOtpVerification.updateOne).toHaveBeenLastCalledWith(
      { _id: 'otp-id' },
      {
        $set: {
          attempts: 5,
          lockedUntil: expect.any(Date),
        },
      },
    );
    expect(await sms.verifyOtpCode('0900000002', '111111')).toBeNull();
  });
});
