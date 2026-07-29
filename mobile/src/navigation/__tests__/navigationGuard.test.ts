import { resolveAppNavigatorMode } from '../navigationGuard';

describe('app navigation guard', () => {
  it('locks users who must change their password into the recovery stack', () => {
    expect(resolveAppNavigatorMode(true)).toBe('force_change_password');
  });

  it('uses the main stack for regular and signed-out sessions', () => {
    expect(resolveAppNavigatorMode(false)).toBe('main');
    expect(resolveAppNavigatorMode(undefined)).toBe('main');
    expect(resolveAppNavigatorMode(null)).toBe('main');
  });
});
