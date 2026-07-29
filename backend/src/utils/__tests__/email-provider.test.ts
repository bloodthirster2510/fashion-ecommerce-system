const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

import {
  EmailDeliveryError,
  clearMockEmailOutbox,
  deliverEmail,
  getMockEmailOutbox,
  resolveEmailProviderName,
} from '../email-provider';

const originalEnv = { ...process.env };

const clearEmailEnv = () => {
  [
    'EMAIL_PROVIDER',
    'EMAIL_REQUEST_TIMEOUT_MS',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ].forEach((name) => delete process.env[name]);
};

describe('email provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockEmailOutbox();
    clearEmailEnv();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses mock automatically outside production and writes to the outbox', async () => {
    expect(resolveEmailProviderName()).toBe('mock');

    await expect(deliverEmail({
      to: 'customer@example.com',
      subject: 'Reset',
      html: '<p>reset</p>',
      logLabel: 'reset password',
    })).resolves.toMatchObject({
      mode: 'mock',
      provider: 'mock',
      messageId: expect.stringMatching(/^mock-email-/),
    });

    expect(getMockEmailOutbox('customer@example.com')).toEqual([
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'Reset',
        html: '<p>reset</p>',
      }),
    ]);
  });

  it('fails closed in production when SMTP is not configured', () => {
    process.env.NODE_ENV = 'production';

    expect(() => resolveEmailProviderName()).toThrow(
      expect.objectContaining({
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        status: 503,
      }),
    );
  });

  it('sends through SMTP only when the provider accepts a recipient', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'mailer@example.com';
    process.env.SMTP_PASS = 'secret';
    mockSendMail.mockResolvedValue({
      messageId: 'smtp-message-1',
      accepted: ['customer@example.com'],
      rejected: [],
    });

    await expect(deliverEmail({
      to: 'customer@example.com',
      subject: 'Reset',
      html: '<p>reset</p>',
      logLabel: 'reset password',
    })).resolves.toEqual({
      mode: 'real',
      provider: 'smtp',
      messageId: 'smtp-message-1',
    });
    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      connectionTimeout: 10_000,
    }));
  });

  it('rejects an SMTP response that accepted no recipient', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'mailer@example.com';
    process.env.SMTP_PASS = 'secret';
    mockSendMail.mockResolvedValue({
      messageId: 'smtp-message-2',
      accepted: [],
      rejected: ['customer@example.com'],
    });

    await expect(deliverEmail({
      to: 'customer@example.com',
      subject: 'Reset',
      html: '<p>reset</p>',
      logLabel: 'reset password',
    })).rejects.toEqual(expect.objectContaining<Partial<EmailDeliveryError>>({
      code: 'EMAIL_PROVIDER_NOT_ACCEPTED',
      status: 502,
    }));
  });
});
