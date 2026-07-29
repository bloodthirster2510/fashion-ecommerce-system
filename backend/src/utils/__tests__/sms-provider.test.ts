import {
  SmsDeliveryError,
  clearMockSmsOutbox,
  deliverOtpSms,
  getMockSmsOutboxEntry,
  getSmsDeliveryCapability,
} from '../sms-provider';

const managedEnvNames = [
  'NODE_ENV',
  'SMS_PROVIDER',
  'SMS_AUTO_PROVIDER',
  'SMS_MOCK_OTP',
  'SMS_MAX_ATTEMPTS',
  'SMS_RETRY_DELAY_MS',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'TWILIO_MESSAGING_SERVICE_SID',
  'ESMS_API_KEY',
  'ESMS_SECRET_KEY',
  'ESMS_BRAND_NAME',
  'ESMS_SMS_TYPE',
  'ESMS_SANDBOX',
] as const;

const originalEnv = Object.fromEntries(
  managedEnvNames.map((name) => [name, process.env[name]]),
) as Record<(typeof managedEnvNames)[number], string | undefined>;

const restoreEnv = () => {
  managedEnvNames.forEach((name) => {
    const value = originalEnv[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  });
};

const mockJsonResponse = (status: number, body: Record<string, unknown>) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
}) as unknown as Response;

describe('SMS delivery providers', () => {
  beforeEach(() => {
    restoreEnv();
    clearMockSmsOutbox();
    jest.restoreAllMocks();
    process.env.SMS_MAX_ATTEMPTS = '1';
  });

  afterAll(restoreEnv);

  it('uses a visible mock outbox automatically outside production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SMS_PROVIDER = 'auto';
    process.env.SMS_MOCK_OTP = '654321';

    expect(getSmsDeliveryCapability()).toEqual({
      mode: 'mock',
      provider: 'mock',
      testOtp: '654321',
    });

    await expect(
      deliverOtpSms('0900000001', '654321', new Date('2030-01-01T00:00:00.000Z')),
    ).resolves.toEqual({
      mode: 'mock',
      provider: 'mock',
      testOtp: '654321',
    });
    expect(getMockSmsOutboxEntry('0900000001')).toEqual(expect.objectContaining({
      otp: '654321',
    }));
  });

  it('refuses to simulate SMS success in production without credentials', () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_PROVIDER = 'auto';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.ESMS_API_KEY;

    expect(() => getSmsDeliveryCapability()).toThrow(
      expect.objectContaining<Partial<SmsDeliveryError>>({
        code: 'SMS_PROVIDER_NOT_CONFIGURED',
        status: 503,
      }),
    );
  });

  it('sends through Twilio and only succeeds after Twilio returns a message SID', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15550000000';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      mockJsonResponse(201, { sid: 'SM123', status: 'queued' }),
    );

    await expect(
      deliverOtpSms('0900000002', '123456', new Date()),
    ).resolves.toEqual({
      mode: 'real',
      provider: 'twilio',
      messageId: 'SM123',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/Accounts/AC123/Messages.json'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('To=%2B84900000002'),
      }),
    );
  });

  it('retries a transient Twilio failure within the configured limit', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SMS_PROVIDER = 'twilio';
    process.env.SMS_MAX_ATTEMPTS = '2';
    process.env.SMS_RETRY_DELAY_MS = '1';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15550000000';
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse(503, {}))
      .mockResolvedValueOnce(mockJsonResponse(201, { sid: 'SM456', status: 'accepted' }));

    await expect(
      deliverOtpSms('0900000003', '123456', new Date()),
    ).resolves.toMatchObject({ provider: 'twilio', messageId: 'SM456' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts eSMS only when CodeResult 100 and SMSID are returned', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SMS_PROVIDER = 'esms';
    process.env.ESMS_API_KEY = 'api-key';
    process.env.ESMS_SECRET_KEY = 'secret-key';
    process.env.ESMS_BRAND_NAME = 'CDSHOP';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      mockJsonResponse(200, { CodeResult: '100', SMSID: 'esms-id' }),
    );

    await expect(
      deliverOtpSms('0900000004', '123456', new Date()),
    ).resolves.toEqual({
      mode: 'real',
      provider: 'esms',
      messageId: 'esms-id',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('SendMultipleMessage_V4_post_json'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
