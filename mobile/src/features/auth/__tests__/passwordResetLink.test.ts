import { getUrlParam, parsePasswordResetLink } from '../passwordResetLink';

describe('password reset deep links', () => {
  it('parses the configured mobile reset link', () => {
    expect(parsePasswordResetLink(
      'fashion-ecommerce://reset-password?identifier=customer%40example.com&token=mock-reset-token',
    )).toEqual({
      identifier: 'customer@example.com',
      token: 'mock-reset-token',
    });
  });

  it('rejects unrelated or incomplete links', () => {
    expect(parsePasswordResetLink('fashion-ecommerce://payment-return?orderId=o1')).toBeNull();
    expect(parsePasswordResetLink('fashion-ecommerce://reset-password?identifier=a%40b.com')).toBeNull();
  });

  it('returns null instead of throwing for malformed encoding', () => {
    expect(getUrlParam('fashion-ecommerce://reset-password?token=%E0%A4%A', 'token')).toBeNull();
  });
});
