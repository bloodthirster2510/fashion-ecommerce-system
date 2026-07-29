export type AppNavigatorMode = 'force_change_password' | 'main';

export const resolveAppNavigatorMode = (
  mustChangePassword: boolean | null | undefined,
): AppNavigatorMode => (mustChangePassword ? 'force_change_password' : 'main');
