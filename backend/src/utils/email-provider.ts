export type EmailProviderName = 'mock' | 'smtp';
export type EmailDeliveryMode = 'mock' | 'real';

export type EmailDeliveryInfo = {
  mode: EmailDeliveryMode;
  provider: EmailProviderName;
};

export type EmailDeliveryResult = EmailDeliveryInfo & {
  messageId?: string;
};

export type EmailMessageInput = {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
};

export type MockEmailOutboxEntry = EmailMessageInput & {
  messageId: string;
  createdAt: Date;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  timeoutMs: number;
};

const mockEmailOutbox: MockEmailOutboxEntry[] = [];

export class EmailDeliveryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options: { status?: number; code: string }) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.status = options.status ?? 502;
    this.code = options.code;
  }
}

export const isEmailDeliveryError = (error: unknown): error is EmailDeliveryError =>
  error instanceof EmailDeliveryError;

const readEnv = (name: string) => process.env[name]?.trim() || '';

const readPositiveInteger = (name: string, fallback: number, maximum: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, maximum) : fallback;
};

const getSmtpConfig = (): SmtpConfig => {
  const user = readEnv('SMTP_USER');
  return {
    host: readEnv('SMTP_HOST'),
    port: readPositiveInteger('SMTP_PORT', 587, 65_535),
    secure: readEnv('SMTP_SECURE').toLowerCase() === 'true',
    user,
    pass: readEnv('SMTP_PASS'),
    from: readEnv('SMTP_FROM') || user,
    timeoutMs: readPositiveInteger('EMAIL_REQUEST_TIMEOUT_MS', 10_000, 60_000),
  };
};

const hasSmtpCredentials = (config = getSmtpConfig()) =>
  Boolean(config.host && config.user && config.pass && config.from);

export const resolveEmailProviderName = (): EmailProviderName => {
  const requestedProvider = (readEnv('EMAIL_PROVIDER') || 'auto').toLowerCase();

  if (!['auto', 'mock', 'smtp'].includes(requestedProvider)) {
    throw new EmailDeliveryError('EMAIL_PROVIDER không hợp lệ', {
      status: 503,
      code: 'EMAIL_PROVIDER_INVALID',
    });
  }

  if (requestedProvider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new EmailDeliveryError('Không được phép dùng mock email trong production', {
        status: 503,
        code: 'EMAIL_MOCK_FORBIDDEN',
      });
    }
    return 'mock';
  }

  if (requestedProvider === 'smtp') {
    if (!hasSmtpCredentials()) {
      throw new EmailDeliveryError('SMTP chưa được cấu hình đầy đủ', {
        status: 503,
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      });
    }
    return 'smtp';
  }

  if (hasSmtpCredentials()) {
    return 'smtp';
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'mock';
  }

  throw new EmailDeliveryError('Email chưa được cấu hình cho môi trường production', {
    status: 503,
    code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
  });
};

export const getEmailDeliveryCapability = (): EmailDeliveryInfo => {
  const provider = resolveEmailProviderName();
  return {
    provider,
    mode: provider === 'mock' ? 'mock' : 'real',
  };
};

const sendWithMock = (input: EmailMessageInput): EmailDeliveryResult => {
  const messageId = `mock-email-${Date.now()}-${mockEmailOutbox.length + 1}`;
  mockEmailOutbox.push({
    ...input,
    messageId,
    createdAt: new Date(),
  });
  return { mode: 'mock', provider: 'mock', messageId };
};

const sendWithSmtp = async (input: EmailMessageInput): Promise<EmailDeliveryResult> => {
  const config = getSmtpConfig();
  if (!hasSmtpCredentials(config)) {
    throw new EmailDeliveryError('SMTP chưa được cấu hình đầy đủ', {
      status: 503,
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
    });
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      socketTimeout: config.timeoutMs,
    });
    const result = await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }) as { messageId?: string; accepted?: unknown[] };
    const accepted = Array.isArray(result.accepted) ? result.accepted : [];

    if (!result.messageId || accepted.length === 0) {
      throw new EmailDeliveryError('SMTP chưa tiếp nhận email', {
        code: 'EMAIL_PROVIDER_NOT_ACCEPTED',
      });
    }

    return {
      mode: 'real',
      provider: 'smtp',
      messageId: result.messageId,
    };
  } catch (error) {
    if (isEmailDeliveryError(error)) {
      throw error;
    }
    throw new EmailDeliveryError(`Không thể gửi ${input.logLabel} email qua SMTP`, {
      code: 'EMAIL_PROVIDER_UNAVAILABLE',
    });
  }
};

export const deliverEmail = async (input: EmailMessageInput): Promise<EmailDeliveryResult> => {
  const provider = resolveEmailProviderName();
  return provider === 'mock' ? sendWithMock(input) : sendWithSmtp(input);
};

export const getMockEmailOutbox = (to?: string) =>
  mockEmailOutbox
    .filter((entry) => !to || entry.to.toLowerCase() === to.toLowerCase())
    .map((entry) => ({ ...entry }));

export const clearMockEmailOutbox = () => {
  mockEmailOutbox.length = 0;
};
