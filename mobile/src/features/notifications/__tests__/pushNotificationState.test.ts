import {
  initialPushNotificationState,
  normalizeStoredPushState,
  shouldOpenDeviceNotificationSettings,
} from '../pushNotificationState';

describe('push notification state', () => {
  it('uses the safe disabled default for invalid storage', () => {
    expect(normalizeStoredPushState(null)).toEqual(initialPushNotificationState);
    expect(normalizeStoredPushState('invalid')).toEqual(initialPushNotificationState);
  });

  it('keeps valid registration values and fills missing preferences', () => {
    expect(
      normalizeStoredPushState({
        enabled: true,
        token: 'ExponentPushToken[test]',
        platform: 'android',
        preferences: { promotion: false, support: false },
      }),
    ).toEqual({
      enabled: true,
      token: 'ExponentPushToken[test]',
      platform: 'android',
      preferences: {
        order: true,
        promotion: false,
        support: false,
        account: true,
        virtual_try_on: true,
        system: true,
      },
    });
  });

  it('drops malformed token and platform fields', () => {
    expect(
      normalizeStoredPushState({
        enabled: 'yes',
        token: '',
        platform: 'windows',
        preferences: { order: 'no' },
      }),
    ).toEqual(initialPushNotificationState);
  });

  it('only offers device settings for permission errors', () => {
    expect(shouldOpenDeviceNotificationSettings('Quyền thông báo chưa được bật')).toBe(true);
    expect(shouldOpenDeviceNotificationSettings('Không thể cập nhật push token')).toBe(false);
  });
});
