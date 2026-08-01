import bcrypt from 'bcryptjs';
import { User } from '../database/models';
import { startApiE2EHarness, type ApiE2EHarness } from './e2e-harness';

type LoginUnlockErrorData = {
  lockedUntil: string;
  retryAfterSeconds: number;
  canUnlock: boolean;
};

type LoginUnlockRequest = {
  method: 'email' | 'phone';
  delivery: {
    mode: 'mock' | 'real';
    provider: string;
    testOtp?: string;
  };
};

describe('login soft lock and OTP recovery', () => {
  let harness: ApiE2EHarness;

  beforeAll(async () => {
    process.env.EMAIL_PROVIDER = 'mock';
    process.env.SMS_PROVIDER = 'mock';
    process.env.LOGIN_MAX_FAILED_ATTEMPTS = '5';
    process.env.LOGIN_LOCK_DURATIONS_MINUTES = '15,30,60';
    harness = await startApiE2EHarness({ databaseName: 'fashion-ecommerce-login-lockout-e2e' });

    await User.create({
      name: 'Login Lock Customer',
      email: 'login-lock@example.com',
      phone: '0901234567',
      password: await bcrypt.hash('CorrectPassword123!', 4),
      role: 'user',
      gender: 'female',
      dateOfBirth: new Date('1995-01-01'),
      address: [{
        customerName: 'Login Lock Customer',
        province: 'Cần Thơ',
        ward: 'Ninh Kiều',
        wardCode: '31135',
        streetName: '1 Đường thử nghiệm',
        phoneNumber: '0901234567',
        isDefault: true,
      }],
      isActive: true,
    });
  });

  afterAll(async () => {
    await harness.stop();
  });

  it('locks after five failures and lets the owner unlock with a one-time email code', async () => {
    for (let attempt = 1; attempt < 5; attempt += 1) {
      const result = await harness.request('/api/auth/login', {
        body: { identifier: 'login-lock@example.com', password: 'wrong-password' },
      });
      expect(result.response.status).toBe(401);
    }

    const locked = await harness.request<LoginUnlockErrorData>('/api/auth/login', {
      body: { identifier: 'login-lock@example.com', password: 'wrong-password' },
    });
    expect(locked.response.status).toBe(429);
    expect(locked.payload.errorCode).toBe('LOGIN_TEMPORARILY_LOCKED');
    expect(locked.payload.data).toEqual(expect.objectContaining({ canUnlock: true }));

    const stillLocked = await harness.request('/api/auth/login', {
      body: { identifier: '0901234567', password: 'CorrectPassword123!' },
    });
    expect(stillLocked.response.status).toBe(429);
    expect(stillLocked.payload.errorCode).toBe('LOGIN_TEMPORARILY_LOCKED');

    const unlockRequest = await harness.request<LoginUnlockRequest>('/api/auth/login/unlock/request', {
      body: { identifier: 'login-lock@example.com' },
    });
    expect(unlockRequest.response.status).toBe(200);
    expect(unlockRequest.payload.data.method).toBe('email');
    expect(unlockRequest.payload.data.delivery.testOtp).toMatch(/^\d{6}$/);

    const invalidOtp = await harness.request('/api/auth/login/unlock/verify', {
      body: { identifier: 'login-lock@example.com', otp: '000000' },
    });
    expect(invalidOtp.response.status).toBe(400);
    expect(invalidOtp.payload.errorCode).toBe('LOGIN_UNLOCK_OTP_INVALID');

    const unlocked = await harness.request('/api/auth/login/unlock/verify', {
      body: {
        identifier: 'login-lock@example.com',
        otp: unlockRequest.payload.data.delivery.testOtp,
      },
    });
    expect(unlocked.response.status).toBe(200);

    const login = await harness.request('/api/auth/login', {
      body: { identifier: '0901234567', password: 'CorrectPassword123!' },
    });
    expect(login.response.status).toBe(200);
  });
});
