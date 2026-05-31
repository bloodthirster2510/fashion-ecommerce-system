import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';

type SocialLink = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
};

const supportLinks = [
  'Hướng dẫn đặt hàng',
  'Giao hàng',
  'Chính sách trả hàng hoàn tiền',
  'Chính sách bảo mật',
  'Liên hệ với chúng tôi',
];

const socialLinks: SocialLink[] = [
  { icon: 'facebook', label: 'Facebook' },
  { icon: 'instagram', label: 'Instagram' },
  { icon: 'alpha-t-circle', label: 'TikTok' },
  { icon: 'alpha-z-circle', label: 'Zalo' },
];

const StorefrontFooter = () => {
  return (
    <View style={styles.footer}>
      <View style={styles.section}>
        <Text style={styles.heading}>GIỚI THIỆU</Text>
        <Text style={styles.bodyText}>Cửa hàng FASHIONISTA</Text>
        <Text style={styles.bodyText}>SĐT: 0123.456.789</Text>
        <Text style={styles.bodyText}>Email: cuahang@gmail.com</Text>
        <Text style={styles.bodyText}>Giờ mở cửa: 8:30 - 22:00</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>HỖ TRỢ</Text>
        {supportLinks.map((item) => (
          <Text key={item} style={styles.bodyText}>
            {item}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>CỘNG ĐỒNG</Text>
        <View style={styles.socialRow}>
          {socialLinks.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.socialButton}
              accessibilityLabel={item.label}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={item.icon} size={18} color={colors.brand} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>THANH TOÁN</Text>
        <View style={styles.paymentRow}>
          <View style={styles.paymentChip}>
            <Text style={styles.paymentText}>COD</Text>
          </View>
          <View style={styles.paymentChip}>
            <Text style={styles.paymentText}>CARD</Text>
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
