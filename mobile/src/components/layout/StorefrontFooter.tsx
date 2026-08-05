import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import { RemoteImage } from '../media/RemoteImage';
import { policyUrls, STOREFRONT_URL } from '../../config/policies';
import { useStorefrontSettings } from '../../features/storefrontSettings/StorefrontSettingsProvider';
import type { StorefrontSocialPlatform } from '../../features/storefrontSettings/storefrontSettings.types';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const supportLinks = [
  { label: 'Trung tâm hỗ trợ', icon: 'lifebuoy' as IconName, url: `${STOREFRONT_URL}/support` },
  { label: 'Hướng dẫn đặt hàng', icon: 'cart-outline' as IconName, url: `${STOREFRONT_URL}/support?topic=orders` },
  { label: 'Chính sách giao hàng', icon: 'truck-fast-outline' as IconName, url: policyUrls.shipping },
  { label: 'Đổi trả & hoàn tiền', icon: 'backup-restore' as IconName, url: policyUrls.returns },
  { label: 'Bảo mật thông tin', icon: 'shield-lock-outline' as IconName, url: policyUrls.privacy },
  { label: 'Tiếp nhận khiếu nại', icon: 'message-alert-outline' as IconName, url: policyUrls.complaints },
];

const socialIconByPlatform: Record<StorefrontSocialPlatform, keyof typeof MaterialCommunityIcons.glyphMap> = {
  facebook: 'facebook',
  instagram: 'instagram',
  tiktok: 'music-note',
  youtube: 'youtube',
  zalo: 'chat-processing-outline',
  other: 'link-variant',
};

const StorefrontFooter = () => {
  const { settings } = useStorefrontSettings();
  const { identity, contact } = settings;
  const socialLinks = settings.socials.filter((item) => item.enabled && item.url);
  const contactItems: Array<{
    key: string;
    label: string;
    value: string;
    icon: IconName;
    url?: string;
  }> = [
    ...(contact.phone ? [{
      key: 'phone',
      label: 'Hotline',
      value: contact.phone,
      icon: 'phone-outline' as IconName,
      url: `tel:${contact.phone.replace(/[^0-9+]/g, '')}`,
    }] : []),
    ...(contact.hours ? [{
      key: 'hours',
      label: 'Giờ phục vụ',
      value: contact.hours,
      icon: 'clock-outline' as IconName,
    }] : []),
    ...(contact.email ? [{
      key: 'email',
      label: 'Email',
      value: contact.email,
      icon: 'email-outline' as IconName,
      url: `mailto:${contact.email}`,
    }] : []),
    ...(contact.address ? [{
      key: 'address',
      label: 'Cửa hàng',
      value: contact.address,
      icon: 'map-marker-outline' as IconName,
      url: contact.mapUrl || undefined,
    }] : []),
  ];

  return (
    <View style={styles.footer}>
      <View pointerEvents="none" style={styles.decorativeGlow} />
      <View style={styles.accentBar} />

      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          {identity.avatarUrl ? (
            <RemoteImage
              uri={identity.avatarUrl}
              style={styles.brandAvatar}
              resizeMode="cover"
              recyclingKey={`storefront-avatar-${identity.avatarUrl}`}
            />
          ) : (
            <MaterialCommunityIcons name="hanger" size={27} color={colors.gold} />
          )}
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandEyebrow}>CHỌN GU RIÊNG · SỐNG CHẤT RIÊNG</Text>
          <Text style={styles.brandName}>{identity.name}</Text>
          {identity.tagline ? <Text style={styles.brandTagline}>{identity.tagline}</Text> : null}
        </View>
      </View>

      {contactItems.length > 0 ? (
        <View style={styles.contactGrid}>
          {contactItems.map((item) => {
            const content = (
              <>
                <View style={styles.contactIcon}>
                  <MaterialCommunityIcons name={item.icon} size={17} color={colors.gold} />
                </View>
                <View style={styles.contactCopy}>
                  <Text style={styles.contactLabel}>{item.label}</Text>
                  <Text style={styles.contactValue} numberOfLines={2}>{item.value}</Text>
                </View>
              </>
            );

            const itemStyle = [
              styles.contactItem,
              (item.key === 'email' || item.key === 'address') && styles.contactItemWide,
              item.key === 'address' && styles.contactItemAddress,
            ];

            return item.url ? (
              <TouchableOpacity
                key={item.key}
                style={itemStyle}
                activeOpacity={0.76}
                accessibilityRole="link"
                accessibilityLabel={`${item.label}: ${item.value}`}
                onPress={() => void Linking.openURL(item.url!)}
              >
                {content}
              </TouchableOpacity>
            ) : (
              <View key={item.key} style={itemStyle}>
                {content}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.sectionHeading}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionEyebrow}>HỖ TRỢ NHANH</Text>
        </View>
      </View>
      <View style={styles.supportGrid}>
        {supportLinks.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.supportLink}
            onPress={() => void Linking.openURL(item.url)}
            activeOpacity={0.76}
            accessibilityRole="link"
            accessibilityLabel={item.label}
          >
            <View style={styles.supportIcon}>
              <MaterialCommunityIcons name={item.icon} size={16} color={colors.gold} />
            </View>
            <Text style={styles.supportLinkText} numberOfLines={2}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerMeta}>
        <View style={styles.metaBlock}>
          <View style={styles.metaHeading}>
            <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.gold} />
            <Text style={styles.metaLabel}>THANH TOÁN AN TOÀN</Text>
          </View>
          <View style={styles.paymentRow}>
            <View style={styles.paymentChip}>
              <MaterialCommunityIcons name="cash-multiple" size={15} color={colors.brandDark} />
              <Text style={styles.paymentText}>COD</Text>
            </View>
            <View style={styles.paymentChip}>
              <Text style={styles.paymentText}>VNPAY</Text>
            </View>
          </View>
        </View>

        {socialLinks.length > 0 ? (
          <View style={styles.metaBlock}>
            <View style={styles.metaHeading}>
              <MaterialCommunityIcons name="account-group-outline" size={17} color={colors.gold} />
              <Text style={styles.metaLabel}>KẾT NỐI VỚI CHÚNG TÔI</Text>
            </View>
            <View style={styles.socialRow}>
              {socialLinks.map((item) => (
                <TouchableOpacity
                  key={`${item.platform}-${item.url}`}
                  style={styles.socialButton}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  activeOpacity={0.76}
                  onPress={() => void Linking.openURL(item.url)}
                >
                  <MaterialCommunityIcons name={socialIconByPlatform[item.platform]} size={19} color={colors.white} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.copyrightRow}>
        <MaterialCommunityIcons name="hanger" size={13} color="rgba(221,231,236,0.7)" />
        <Text style={styles.copyright}>© {new Date().getFullYear()} {identity.name} · All rights reserved</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  decorativeGlow: {
    position: 'absolute',
    top: -90,
    right: -72,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(107,140,168,0.14)',
  },
  accentBar: {
    width: 36,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    marginBottom: 10,
  },
  brandRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(246,199,107,0.5)',
    backgroundColor: 'rgba(246,199,107,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandAvatar: {
    width: '100%',
    height: '100%',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandEyebrow: {
    color: colors.gold,
    fontSize: 7.5,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1.15,
    marginBottom: spacing.xs,
  },
  brandName: {
    color: colors.white,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  brandTagline: {
    color: colors.brandPale,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  contactGrid: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  contactItem: {
    width: '48.8%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(221,231,236,0.12)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  contactItemWide: {
    width: '100%',
  },
  contactItemAddress: {
    minHeight: 52,
  },
  contactIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(246,199,107,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
  },
  contactLabel: {
    color: 'rgba(221,231,236,0.72)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  contactValue: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 14,
  },
  sectionHeading: {
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  sectionEyebrow: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  supportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  supportLink: {
    width: '48.8%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  supportIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportLinkText: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  footerMeta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(221,231,236,0.12)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  metaHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaLabel: {
    color: colors.brandPale,
    fontSize: 7.5,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  socialButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(221,231,236,0.16)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  paymentChip: {
    minWidth: 52,
    height: 30,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  paymentText: {
    color: colors.brandDark,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
  },
  copyrightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  copyright: {
    color: 'rgba(221,231,236,0.7)',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default StorefrontFooter;
