import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import { policyUrls, STOREFRONT_URL } from '../../config/policies';

type SocialLink = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  url: string;
};

const supportLinks = [
  { label: 'Hướng dẫn đặt hàng', url: `${STOREFRONT_URL}/support?topic=orders` },
  { label: 'Chính sách giao hàng', url: policyUrls.shipping },
  { label: 'Trả hàng và hoàn tiền', url: policyUrls.returns },
  { label: 'Chính sách bảo mật', url: policyUrls.privacy },
  { label: 'Tiếp nhận khiếu nại', url: policyUrls.complaints },
];

const socialLinkCandidates: SocialLink[] = [
  { icon: 'facebook', label: 'Facebook', url: process.env.EXPO_PUBLIC_FACEBOOK_URL?.trim() || '' },
  { icon: 'instagram', label: 'Instagram', url: process.env.EXPO_PUBLIC_INSTAGRAM_URL?.trim() || '' },
  { icon: 'alpha-t-circle', label: 'TikTok', url: process.env.EXPO_PUBLIC_TIKTOK_URL?.trim() || '' },
];

const socialLinks = socialLinkCandidates.filter((item) => Boolean(item.url));

const shopPhone = process.env.EXPO_PUBLIC_SHOP_PHONE?.trim();
const shopEmail = process.env.EXPO_PUBLIC_SHOP_EMAIL?.trim();
const shopHours = process.env.EXPO_PUBLIC_SHOP_HOURS?.trim();

const StorefrontFooter = () => {
  return (
    <View style={styles.footer}>
      <View style={styles.section}>
        <Text style={styles.heading}>GIỚI THIỆU</Text>
        <Text style={styles.bodyText}>Cửa hàng FASHIONISTA</Text>
        {shopPhone ? (
          <TouchableOpacity onPress={() => void Linking.openURL(`tel:${shopPhone}`)}>
            <Text style={styles.bodyText}>SĐT: {shopPhone}</Text>
          </TouchableOpacity>
        ) : null}
        {shopEmail ? (
          <TouchableOpacity onPress={() => void Linking.openURL(`mailto:${shopEmail}`)}>
            <Text style={styles.bodyText}>Email: {shopEmail}</Text>
          </TouchableOpacity>
        ) : null}
        {shopHours ? <Text style={styles.bodyText}>Giờ mở cửa: {shopHours}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>HỖ TRỢ</Text>
        {supportLinks.map((item) => (
          <TouchableOpacity key={item.label} onPress={() => void Linking.openURL(item.url)}>
            <Text style={styles.bodyText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {socialLinks.length > 0 ? <View style={styles.section}>
        <Text style={styles.heading}>CỘNG ĐỒNG</Text>
        <View style={styles.socialRow}>
          {socialLinks.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.socialButton}
              accessibilityLabel={item.label}
              activeOpacity={0.8}
              onPress={() => void Linking.openURL(item.url)}
            >
              <MaterialCommunityIcons name={item.icon} size={18} color={colors.brand} />
            </TouchableOpacity>
          ))}
        </View>
      </View> : null}

      <View style={styles.section}>
        <Text style={styles.heading}>THANH TOÁN</Text>
        <View style={styles.paymentRow}>
          <View style={styles.paymentChip}>
            <Text style={styles.paymentText}>COD</Text>
          </View>
          <View style={styles.paymentChip}>
            <Text style={styles.paymentText}>VNPAY</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  heading: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  bodyText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 18,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  socialButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  paymentChip: {
    minWidth: 48,
    height: 25,
    borderRadius: radii.xs,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  paymentText: {
    color: colors.brand,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
});

export default StorefrontFooter;
