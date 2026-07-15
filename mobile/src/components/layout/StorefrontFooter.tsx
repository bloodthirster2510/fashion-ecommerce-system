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
    ...(contact.email ? [{
      key: 'email',
      label: 'Email',
      value: contact.email,
      icon: 'email-outline' as IconName,
      url: `mailto:${contact.email}`,
    }] : []),
    ...(contact.hours ? [{
      key: 'hours',
      label: 'Giờ phục vụ',
      value: contact.hours,
      icon: 'clock-outline' as IconName,
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
        <View style={styles.contactList}>
          {contactItems.map((item, index) => {
            const content = (
              <>
                <View style={styles.contactIcon}>
                  <MaterialCommunityIcons name={item.icon} size={18} color={colors.gold} />
                </View>
                <View style={styles.contactCopy}>
                  <Text style={styles.contactLabel}>{item.label}</Text>
                  <Text style={styles.contactValue} numberOfLines={2}>{item.value}</Text>
                </View>
                {item.url ? <MaterialCommunityIcons name="chevron-right" size={17} color={colors.brandPale} /> : null}
              </>
            );

            return item.url ? (
              <TouchableOpacity
                key={item.key}
                style={[styles.contactItem, index < contactItems.length - 1 && styles.contactItemDivider]}
                activeOpacity={0.76}
                accessibilityRole="link"
                accessibilityLabel={`${item.label}: ${item.value}`}
                onPress={() => void Linking.openURL(item.url!)}
              >
                {content}
              </TouchableOpacity>
            ) : (
              <View key={item.key} style={[styles.contactItem, index < contactItems.length - 1 && styles.contactItemDivider]}>
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
        <Text style={styles.sectionHint}>Thông tin bạn cần, ngay tại đây</Text>
      </View>
      <View style={styles.supportGrid}>
        {supportLinks.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.supportLink, index < supportLinks.length - 2 && styles.supportLinkDivider]}
            onPress={() => void Linking.openURL(item.url)}
            activeOpacity={0.76}
            accessibilityRole="link"
            accessibilityLabel={item.label}
          >
            <View style={styles.supportIcon}>
              <MaterialCommunityIcons name={item.icon} size={17} color={colors.gold} />
            </View>
            <Text style={styles.supportLinkText} numberOfLines={2}>{item.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.brandPale} />
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  decorativeGlow: {
    position: 'absolute',
    top: -104,
    right: -88,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(107,140,168,0.18)',
  },
  accentBar: {
    width: 42,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    marginBottom: spacing.lg,
  },
  brandRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.15,
    marginBottom: spacing.xs,
  },
  brandName: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  brandTagline: {
    color: colors.brandPale,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  contactList: {
    marginTop: spacing.xl,
  },
  contactItem: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  contactItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(221,231,236,0.12)',
  },
  contactIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
  },
  contactLabel: {
    color: 'rgba(221,231,236,0.72)',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  contactValue: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: spacing.xl,
  },
  sectionHeading: {
    marginBottom: spacing.md,
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
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionHint: {
    color: 'rgba(221,231,236,0.68)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginLeft: 14,
  },
  supportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
  },
  supportLink: {
    width: '47.5%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  supportLinkDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(221,231,236,0.1)',
  },
  supportIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportLinkText: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  footerMeta: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(221,231,236,0.12)',
    gap: spacing.lg,
  },
  metaBlock: {
    gap: spacing.md,
  },
  metaHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaLabel: {
    color: colors.brandPale,
    fontSize: 9,
    lineHeight: 13,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
    minWidth: 58,
    height: 32,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  copyright: {
    color: 'rgba(221,231,236,0.7)',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default StorefrontFooter;
