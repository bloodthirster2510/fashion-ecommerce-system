import crypto from 'crypto';

export type SmsProviderName = 'mock' | 'twilio' | 'esms';
export type SmsDeliveryMode = 'mock' | 'real';

export type SmsDeliveryInfo = {
  mode: SmsDeliveryMode;
  provider: SmsProviderName;
  testOtp?: string;
};

export type SmsDeliveryResult = SmsDeliveryInfo & {
  messageId?: string;
};

type MockSmsOutboxEntry = {
  phone: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
};

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string | null;
  messagingServiceSid: string | null;
};

type EsmsConfig = {
  apiKey: string;
  secretKey: string;
  brandName: string | null;
  smsType: string;
  sandbox: string;
  endpoint: string;
};

const DEFAULT_ESMS_ENDPOINT =
  'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';
const mockSmsOutbox = new Map<string, MockSmsOutboxEntry>();

export class SmsDeliveryError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; code: string; retryable?: boolean }) {
    super(message);
    this.name = 'SmsDeliveryError';
    this.status = options.status ?? 502;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

export const isSmsDeliveryError = (error: unknown): error is SmsDeliveryError =>
  error instanceof SmsDeliveryError;

const readEnv = (name: string) => process.env[name]?.trim() || '';

const readPositiveInteger = (name: string, fallback: number, maximum: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, maximum) : fallback;
};

const getTwilioConfig = (): TwilioConfig => ({
  accountSid: readEnv('TWILIO_ACCOUNT_SID'),
  authToken: readEnv('TWILIO_AUTH_TOKEN'),
  fromNumber: readEnv('TWILIO_FROM_NUMBER') || null,
  messagingServiceSid: readEnv('TWILIO_MESSAGING_SERVICE_SID') || null,
});

const getEsmsConfig = (): EsmsConfig => ({
  apiKey: readEnv('ESMS_API_KEY'),
  secretKey: readEnv('ESMS_SECRET_KEY'),
  brandName: readEnv('ESMS_BRAND_NAME') || readEnv('ESMS_BRANDNAME') || null,
  smsType: readEnv('ESMS_SMS_TYPE') || '2',
  sandbox: readEnv('ESMS_SANDBOX') === 'true' ? '1' : '0',
  endpoint: readEnv('ESMS_ENDPOINT') || DEFAULT_ESMS_ENDPOINT,
});

const hasTwilioCredentials = (config = getTwilioConfig()) =>
  Boolean(
    config.accountSid
    && config.authToken
    && (config.fromNumber || config.messagingServiceSid),
  );

const hasEsmsCredentials = (config = getEsmsConfig()) =>
  Boolean(
    config.apiKey
    && config.secretKey
    && (config.smsType !== '2' || config.brandName),
  );

const assertProviderConfigured = (provider: Exclude<SmsProviderName, 'mock'>) => {
  const configured = provider === 'twilio'
    ? hasTwilioCredentials()
    : hasEsmsCredentials();

  if (!configured) {
    throw new SmsDeliveryError(`SMS provider ${provider} chưa được cấu hình đầy đủ`, {
      status: 503,
      code: 'SMS_PROVIDER_NOT_CONFIGURED',
    });
  }
};

export const resolveSmsProviderName = (): SmsProviderName => {
  const requestedProvider = (readEnv('SMS_PROVIDER') || 'auto').toLowerCase();

  if (!['auto', 'mock', 'twilio', 'esms'].includes(requestedProvider)) {
    throw new SmsDeliveryError('SMS_PROVIDER không hợp lệ', {
      status: 503,
      code: 'SMS_PROVIDER_INVALID',
    });
  }

  if (requestedProvider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new SmsDeliveryError('Không được phép dùng mock SMS trong production', {
        status: 503,
        code: 'SMS_MOCK_FORBIDDEN',
      });
    }
    return 'mock';
  }

  if (requestedProvider === 'twilio' || requestedProvider === 'esms') {
    assertProviderConfigured(requestedProvider);
    return requestedProvider;
  }

  const preferredProvider = readEnv('SMS_AUTO_PROVIDER').toLowerCase();
  const candidates: Array<'esms' | 'twilio'> = preferredProvider === 'twilio'
    ? ['twilio', 'esms']
    : ['esms', 'twilio'];
  const realProvider = candidates.find((provider) =>
    provider === 'twilio' ? hasTwilioCredentials() : hasEsmsCredentials());

  if (realProvider) {
    return realProvider;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'mock';
  }

  throw new SmsDeliveryError('SMS chưa được cấu hình cho môi trường production', {
    status: 503,
    code: 'SMS_PROVIDER_NOT_CONFIGURED',
  });
};

const getMockOtp = () => {
  const otp = readEnv('SMS_MOCK_OTP') || '123456';
  if (!/^\d{6}$/.test(otp)) {
    throw new SmsDeliveryError('SMS_MOCK_OTP phải gồm đúng 6 chữ số', {
      status: 503,
      code: 'SMS_MOCK_OTP_INVALID',
    });
  }
  return otp;
};

export const getSmsDeliveryCapability = (): SmsDeliveryInfo => {
  const provider = resolveSmsProviderName();
  return {
    provider,
    mode: provider === 'mock' ? 'mock' : 'real',
    ...(provider === 'mock' ? { testOtp: getMockOtp() } : {}),
  };
};

const getOtpMessage = (otp: string) => {
  const template = readEnv('SMS_OTP_TEMPLATE')
    || 'Mã OTP của bạn là {OTP}. Mã có hiệu lực trong 5 phút.';
  return template.includes('{OTP}')
    ? template.split('{OTP}').join(otp)
    : `${template} ${otp}`;
};

const toTwilioPhone = (phone: string) => {
  const normalized = phone.replace(/[\s()-]/g, '');
  if (normalized.startsWith('+')) return normalized;
  if (normalized.startsWith('0')) return `+84${normalized.slice(1)}`;
  return normalized;
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const requestJson = async (
  provider: Exclude<SmsProviderName, 'mock'>,
  url: string,
  init: RequestInit,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger('SMS_REQUEST_TIMEOUT_MS', 10_000, 60_000),
  );

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const responseText = await response.text();
    let payload: Record<string, unknown> = {};

    try {
      payload = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new SmsDeliveryError(`Nhà cung cấp ${provider} từ chối yêu cầu gửi SMS`, {
        status: 502,
        code: 'SMS_PROVIDER_REJECTED',
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    return payload;
  } catch (error) {
    if (isSmsDeliveryError(error)) {
      throw error;
    }
    throw new SmsDeliveryError(`Không thể kết nối nhà cung cấp ${provider}`, {
      status: 502,
      code: 'SMS_PROVIDER_UNAVAILABLE',
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const withLimitedRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  const maxAttempts = readPositiveInteger('SMS_MAX_ATTEMPTS', 2, 3);
  const retryDelayMs = readPositiveInteger('SMS_RETRY_DELAY_MS', 250, 5_000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSmsDeliveryError(error) || !error.retryable || attempt >= maxAttempts) {
        throw error;
      }
      await wait(retryDelayMs * attempt);
    }
  }

  throw lastError;
};

const deliverWithTwilio = async (phone: string, otp: string): Promise<SmsDeliveryResult> => {
  const config = getTwilioConfig();
  assertProviderConfigured('twilio');
  const form = new URLSearchParams({
    To: toTwilioPhone(phone),
    Body: getOtpMessage(otp),
  });

  if (config.messagingServiceSid) {
    form.set('MessagingServiceSid', config.messagingServiceSid);
  } else if (config.fromNumber) {
    form.set('From', config.fromNumber);
  }

  const payload = await withLimitedRetry(() =>
    requestJson(
      'twilio',
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    ));
  const messageId = typeof payload.sid === 'string' ? payload.sid : '';
  const status = typeof payload.status === 'string' ? payload.status : '';

  if (!messageId || ['failed', 'undelivered', 'canceled'].includes(status)) {
    throw new SmsDeliveryError('Twilio chưa tiếp nhận yêu cầu gửi SMS', {
      code: 'SMS_PROVIDER_NOT_ACCEPTED',
    });
  }

  return { mode: 'real', provider: 'twilio', messageId };
};

const deliverWithEsms = async (phone: string, otp: string): Promise<SmsDeliveryResult> => {
  const config = getEsmsConfig();
  assertProviderConfigured('esms');
  const requestId = `otp-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const payload = await withLimitedRetry(() =>
    requestJson('esms', config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ApiKey: config.apiKey,
        SecretKey: config.secretKey,
        Phone: phone,
        Content: getOtpMessage(otp),
        SmsType: config.smsType,
        IsUnicode: '1',
        Sandbox: config.sandbox,
        RequestId: requestId,
        ...(config.brandName ? { Brandname: config.brandName } : {}),
      }),
    }));
  const resultCode = String(payload.CodeResult ?? '');
  const messageId = typeof payload.SMSID === 'string' ? payload.SMSID : '';

  if (resultCode !== '100' || !messageId) {
    throw new SmsDeliveryError('eSMS chưa tiếp nhận yêu cầu gửi SMS', {
      code: 'SMS_PROVIDER_NOT_ACCEPTED',
    });
  }

  return { mode: 'real', provider: 'esms', messageId };
};

const deliverWithMock = (
  phone: string,
  otp: string,
  expiresAt: Date,
): SmsDeliveryResult => {
  mockSmsOutbox.set(phone, {
    phone,
    otp,
    expiresAt,
    createdAt: new Date(),
  });
  return { mode: 'mock', provider: 'mock', testOtp: otp };
};

export const deliverOtpSms = async (
  phone: string,
  otp: string,
  expiresAt: Date,
): Promise<SmsDeliveryResult> => {
  const provider = resolveSmsProviderName();

  if (provider === 'twilio') {
    return deliverWithTwilio(phone, otp);
  }
  if (provider === 'esms') {
    return deliverWithEsms(phone, otp);
  }
  return deliverWithMock(phone, otp, expiresAt);
};

export const getMockSmsOutboxEntry = (phone: string) => {
  const entry = mockSmsOutbox.get(phone);
  return entry ? { ...entry } : null;
};

export const clearMockSmsOutbox = () => {
  mockSmsOutbox.clear();
};
