import React from 'react';
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';

type ColorSwatchSize = 'sm' | 'md';

type ColorSwatchProps = {
  label?: string;
  colorCode?: string;
  imageUri?: string;
  selected?: boolean;
  disabled?: boolean;
  size?: ColorSwatchSize;
  selectedTint?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onPress?: () => void;
};

type ResolvedColorSwatch = {
  value: string;
  isFallback: boolean;
};

const sourceColorHexMap: Record<string, string> = {
  BEE: '#F5F5DC',
  BSA: '#F5F5DC',
  CAM: '#F36B26',
  CBA: '#1790C8',
  CHI: '#A0A0A0',
  CVT: '#7BBA3C',
  DDL: '#000000',
  DDO: '#E7352B',
  DEN: '#111111',
  DET: '#111111',
  DGH: '#111111',
  DKT: '#E7352B',
  DN1: '#1C1C1C',
  DOD: '#E7352B',
  GAH: '#E7352B',
  GHD: '#CCCCCC',
  GHI: '#CCCCCC',
  HG1: '#F0728F',
  HOG: '#F0728F',
  IDC: '#000000',
  IDG: '#000000',
  IDX: '#000000',
  ITC: '#FFFFFF',
  ITG: '#FFFFFF',
  ITX: '#FFFFFF',
  KEM: '#F5F5DC',
  NAD: '#825D41',
  NAN: '#825D41',
  NAU: '#825D41',
  NAV: '#000080',
  NKT: '#000080',
  NSU: '#825D41',
  REU: '#636B2F',
  TAN: '#CCCCCC',
  TGD: '#FFFFFF',
  THX: '#000080',
  TIK: '#000080',
  TIT: '#000080',
  TKA: '#FFFFFF',
  TKC: '#FFFFFF',
  TKD: '#FFFFFF',
  TKE: '#FFFFFF',
  TKG: '#CCCCCC',
  TKH: '#FFFFFF',
  TKN: '#FFFFFF',
  TKX: '#FFFFFF',
  TMT: '#FFFFFF',
  TNY: '#FFFFFF',
  TRA: '#FFFFFF',
  TRD: '#FFFFFF',
  TRG: '#FFFFFF',
  TTM: '#FFFFFF',
  VAG: '#FED533',
  XAH: '#1790C8',
  XAM: '#CCCCCC',
  XAR: '#7BBA3C',
  XBD: '#1790C8',
  XBI: '#1790C8',
  XCV: '#7BBA3C',
  XDE: '#111111',
  XH1: '#1790C8',
  XLA: '#7BBA3C',
  XLO: '#1790C8',
  XMN: '#67F0E5',
  XN1: '#1790C8',
  XNA: '#CCCCCC',
  XNG: '#67F0E5',
  XTI: '#1790C8',
};

const colorNameHexMap: Array<{ terms: string[]; value: string }> = [
  { terms: ['den', 'black'], value: '#111111' },
  { terms: ['trang', 'white'], value: '#FFFFFF' },
  { terms: ['be', 'beige', 'kem', 'cream'], value: '#E8D8BE' },
  { terms: ['nau', 'brown'], value: '#7A5137' },
  { terms: ['xam', 'ghi', 'gray', 'grey'], value: '#9EA4AA' },
  { terms: ['navy'], value: '#1F2A44' },
  { terms: ['xanh jean', 'xanh duong', 'xanh bien', 'blue'], value: '#4F7EA8' },
  { terms: ['reu', 'olive'], value: '#66724A' },
  { terms: ['xanh'], value: '#5E8FB4' },
  { terms: ['do', 'red'], value: '#C62828' },
  { terms: ['hong', 'pink'], value: '#E89AB5' },
  { terms: ['vang', 'yellow'], value: '#F2CF62' },
  { terms: ['cam', 'orange'], value: '#F2994A' },
  { terms: ['tim', 'purple'], value: '#7B5FA7' },
];

const sizeConfig: Record<ColorSwatchSize, { outer: number; inner: number; icon: number }> = {
  sm: { outer: 40, inner: 28, icon: 15 },
  md: { outer: 44, inner: 31, icon: 17 },
};

const normalizeColorText = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const escapeTerm = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasColorTerm = (value: string, term: string) =>
  new RegExp(`(^|\\s)${escapeTerm(term)}(?=\\s|$)`).test(value);

const isHexColor = (value?: string) => Boolean(value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()));

const normalizeHex = (value: string) => {
  const hex = value.trim();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toUpperCase();
  }
  return hex.slice(0, 7).toUpperCase();
};

const getRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace('#', '');
  const numeric = Number.parseInt(normalized, 16);

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const isLightColor = (hex: string) => {
  if (!isHexColor(hex)) {
    return true;
  }

  const { r, g, b } = getRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 176;
};

export const resolveColorSwatch = (label?: string, colorCode?: string): ResolvedColorSwatch => {
  const code = colorCode?.trim();

  if (code && isHexColor(code)) {
    return { value: normalizeHex(code), isFallback: false };
  }

  if (code) {
    const sourceColor = sourceColorHexMap[code.toUpperCase()];
    if (sourceColor) {
      return { value: sourceColor, isFallback: false };
    }
  }

  const normalizedLabel = normalizeColorText(label);
  const nameColor = colorNameHexMap.find((item) => item.terms.some((term) => hasColorTerm(normalizedLabel, term)));

  return {
    value: nameColor?.value ?? colors.brandPale,
    isFallback: !nameColor,
  };
};

const ColorSwatch = ({
  label,
  colorCode,
  imageUri,
  selected = false,
  disabled = false,
  size = 'md',
  selectedTint = colors.action,
  style,
  accessibilityLabel,
  onPress,
}: ColorSwatchProps) => {
  const resolved = resolveColorSwatch(label, colorCode);
  const config = sizeConfig[size];
  const light = isLightColor(resolved.value);
  const showImageFallback = resolved.isFallback && Boolean(imageUri);
  const checkColor = light ? colors.text : colors.white;
  const containerStyle = (pressed = false) => [
    styles.button,
    {
      width: config.outer,
      height: config.outer,
      borderRadius: config.outer / 2,
      borderColor: selected ? selectedTint : colors.borderStrong,
      borderWidth: selected ? 2 : 1,
      opacity: disabled ? 0.42 : pressed ? 0.72 : 1,
    },
    style,
  ];
  const content = (
    <View
      style={[
        styles.inner,
        {
          width: config.inner,
          height: config.inner,
          borderRadius: config.inner / 2,
          backgroundColor: resolved.value,
          borderColor: light ? colors.borderStrong : 'rgba(255,255,255,0.5)',
        },
      ]}
    >
      {showImageFallback ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" /> : null}
      {selected ? (
        <View style={styles.check}>
          <MaterialCommunityIcons name="check" size={config.icon} color={checkColor} />
        </View>
      ) : null}
      {disabled ? <View style={styles.disabledSlash} /> : null}
    </View>
  );

  if (!onPress) {
    return <View style={containerStyle()}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => containerStyle(pressed)}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  check: {
    minWidth: 21,
    minHeight: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  disabledSlash: {
    position: 'absolute',
    width: 2,
    height: '128%',
    backgroundColor: colors.textMuted,
    transform: [{ rotate: '45deg' }],
  },
});

export default ColorSwatch;
