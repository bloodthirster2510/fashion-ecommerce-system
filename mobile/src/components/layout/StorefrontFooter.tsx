import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import { policyUrls, STOREFRONT_URL } from '../../config/policies';
import { useStorefrontSettings } from '../../features/storefrontSettings/StorefrontSettingsProvider';
import type { StorefrontSocialPlatform } from '../../features/storefrontSettings/storefrontSettings.types';

const supportLinks = [
  { label: 'Hướng dẫn đặt hàng', url: `${STOREFRONT_URL}/support?topic=orders` },
  { label: 'Chính sách giao hàng', url: policyUrls.shipping },
  { label: 'Trả hàng và hoàn tiền', url: policyUrls.returns },
  { label: 'Chính sách bảo mật', url: policyUrls.privacy },
  { label: 'Tiếp nhận khiếu nại', url: policyUrls.complaints },
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

  return (
    <View style={styles.footer}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="hanger" size={22} color={colors.brandDark} />
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>{identity.name}</Text>
          {identity.tagline ? <Text style={styles.brandTagline}>{identity.tagline}</Text> : null}
        </View>
      </View>

      {(contact.phone || contact.email || contact.hours || contact.address) ? (
        <View style={styles.contactRow}>
          {contact.phone ? (
            <TouchableOpacity onPress={() => void Linking.openURL(`tel:${contact.phone.replace(/[^0-9+]/g, '')}`)}>
              <Text style={styles.contactText}>{contact.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {contact.email ? (
            <TouchableOpacity onPress={() => void Linking.openURL(`mailto:${contact.email}`)}>
              <Text style={styles.contactText}>{contact.email}</Text>
            </TouchableOpacity>
          ) : null}
          {contact.hours ? <Text style={styles.contactText}>{contact.hours}</Text> : null}
          {contact.address ? (
            <TouchableOpacity disabled={!contact.mapUrl} onPress={() => contact.mapUrl ? void Linking.openURL(contact.mapUrl) : undefined}>
              <Text style={styles.contactText}>{contact.address}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionEyebrow}>HỖ TRỢ NHANH</Text>
      <View style={styles.supportGrid}>
        {supportLinks.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.supportLink}
            onPress={() => void Linking.openURL(item.url)}
            activeOpacity={0.76}
          >
            <Text style={styles.supportLinkText} numberOfLines={2}>{item.label}</Text>
            <MaterialCommunityIcons name="arrow-top-right" size={13} color={colors.brandPale} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerMeta}>
        <View>
          <Text style={styles.metaLabel}>THANH TOÁN AN TOÀN</Text>
          <View style={styles.paymentRow}>
            <View style={styles.paymentChip}>
              <Text style={styles.paymentText}>COD</Text>
            </View>
            <View style={styles.paymentChip}>
              <Text style={styles.paymentText}>VNPAY</Text>
            </View>
          </View>
        </View>

        {socialLinks.length > 0 ? (
          <View style={styles.socialRow}>
            {socialLinks.map((item) => (
              <TouchableOpacity
                key={`${item.platform}-${item.url}`}
                style={styles.socialButton}
                accessibilityLabel={item.label}
                activeOpacity={0.8}
                onPress={() => void Linking.openURL(item.url)}
              >
                <MaterialCommunityIcons name={socialIconByPlatform[item.platform]} size={16} color={colors.brandDark} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <Text style={styles.copyright}>© {new Date().getFullYear()} {identity.name} · All rights reserved</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  brandRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  brandTagline: {
    color: colors.brandPale,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  contactText: {
    color: colors.brandPale,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: spacing.lg,
  },
  sectionEyebrow: {
    color: colors.gold,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  supportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 2,
  },
  supportLink: {
    width: '48%',
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  supportLinkText: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  footerMeta: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metaLabel: {
    color: colors.brandPale,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  socialButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  paymentChip: {
    minWidth: 42,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  paymentText: {
    color: colors.brandDark,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
  },
  copyright: {
    color: 'rgba(221,231,236,0.64)',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '600',
    marginTop: spacing.md,
  },
});

export default StorefrontFooter;
