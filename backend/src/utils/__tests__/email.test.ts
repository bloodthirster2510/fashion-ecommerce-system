import {
  getResetPasswordEmailCapability,
  sendResetPasswordEmail,
} from '../email';
import {
  clearMockEmailOutbox,
  getMockEmailOutbox,
} from '../email-provider';

const originalEnv = { ...process.env };

describe('reset password email', () => {
  beforeEach(() => {
    clearMockEmailOutbox();
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.EMAIL_MOCK_RESET_TOKEN = 'mock-reset-token-0000000000000001';
    process.env.PASSWORD_RESET_WEB_URL = 'http://localhost:5173/reset-password';
    process.env.PASSWORD_RESET_MOBILE_URL = 'fashion-ecommerce://reset-password';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('provides a deterministic non-production token without revealing account existence', () => {
    expect(getResetPasswordEmailCapability('customer@example.com')).toEqual({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: expect.stringContaining('fashion-ecommerce://reset-password?'),
    });
  });

  it('writes both mobile and web reset links to the mock outbox', async () => {
    const delivery = await sendResetPasswordEmail(
      'customer@example.com',
      'mock-reset-token-0000000000000001',
    );

    expect(delivery).toMatchObject({
      mode: 'mock',
      provider: 'mock',
      testToken: 'mock-reset-token-0000000000000001',
      testUrl: expect.stringContaining('identifier=customer%40example.com'),
    });
    const [message] = getMockEmailOutbox('customer@example.com');
    expect(message.html).toContain('fashion-ecommerce://reset-password');
    expect(message.html).toContain('http://localhost:5173/reset-password');
    expect(message.html).toContain('token=mock-reset-token-0000000000000001');
  });
});
