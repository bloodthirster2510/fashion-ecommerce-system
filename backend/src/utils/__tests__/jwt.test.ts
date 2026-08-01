import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../jwt';

describe('jwt utilities', () => {
  const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
  const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;

  afterEach(() => {
    process.env.JWT_ACCESS_SECRET = originalAccessSecret;
    process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
  });

  it('requires JWT secrets instead of using hardcoded fallbacks', () => {
    delete process.env.JWT_ACCESS_SECRET;

    expect(() =>
      generateAccessToken({ userId: 'u1', email: 'a@example.com', role: 'user' }),
    ).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('signs and verifies access and refresh tokens with HS256', () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const payload = { userId: 'u1', email: 'a@example.com', role: 'user' };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    expect(verifyAccessToken(accessToken)).toMatchObject({
      ...payload,
      issuedAtMs: expect.any(Number),
    });
    expect(verifyRefreshToken(refreshToken)).toMatchObject(payload);
  });
});
