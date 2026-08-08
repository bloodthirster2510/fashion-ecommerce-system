import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  brand: '#547792',
  brandLight: '#6B8CA8',
  brandDark: '#213448',
  brandMist: '#EAF1F5',
  brandPale: '#DDE7EC',
  brandSoft: '#EDF4F7',
  background: '#F4F6F4',
  surface: '#FFFFFF',
  field: '#F9F9F9',
  border: '#DDE3E7',
  borderStrong: '#D1D5DC',
  text: '#213448',
  textBody: '#333333',
  textMuted: '#687782',
  textSubtle: '#9AA3B2',
  white: '#FFFFFF',
  black: '#000000',
  action: '#007BFF',
  disabled: '#CCCCCC',
  danger: '#CC0000',
  dangerSoft: '#FCE4E4',
  success: '#198754',
  successSoft: '#ECFDF3',
  coral: '#D8755B',
  gold: '#F6C76B',
  goldDark: '#C99734',
  goldSoft: '#FFF4DE',
  goldText: '#7B551E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  } satisfies ViewStyle,
} as const;

export const sharedStyles = {
  flex: {
    flex: 1,
  } satisfies ViewStyle,
  authContainer: {
    flex: 1,
    backgroundColor: colors.brand,
  } satisfies ViewStyle,
  authScrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  } satisfies ViewStyle,
  authTopHeader: {
    height: 60,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
  } satisfies ViewStyle,
  authHeaderBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  authHeaderBackIcon: {
    color: colors.white,
    fontSize: 32,
    lineHeight: 32,
  } satisfies TextStyle,
  authHeaderTitle: {
    flex: 1,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.white,
  } satisfies TextStyle,
  authHeaderSpacer: {
    width: 36,
  } satisfies ViewStyle,
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textBody,
    marginBottom: spacing.sm,
  } satisfies TextStyle,
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 15,
    fontSize: 16,
    color: colors.textBody,
    backgroundColor: colors.field,
  } satisfies TextStyle,
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  } satisfies TextStyle,
  disabledButton: {
    backgroundColor: colors.disabled,
  } satisfies ViewStyle,
  card: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    ...shadows.card,
  } satisfies ViewStyle,
} as const;

export const brandedHeaderStyles = {
  container: {
    minHeight: 96,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } satisfies ViewStyle,
  action: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  } satisfies ViewStyle,
  titleGroup: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  } satisfies ViewStyle,
  title: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 2,
  } satisfies TextStyle,
} as const;
