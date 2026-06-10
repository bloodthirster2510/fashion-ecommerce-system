import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MembershipTier } from './accountApi';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type MembershipTierVisualConfig = {
  bgColor: string;
  textColor: string;
  badgeColor: string;
  icon: IconName;
};

const hexColorRegex = /^#([0-9a-fA-F]{6})$/;

const normalizeColor = (value: string | undefined, fallback: string) => {
  if (value && hexColorRegex.test(value)) {
    return value;
  }

  return fallback;
};

const normalizeIconName = (value: string | undefined, fallback: IconName) => {
  if (value && Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, value)) {
    return value as IconName;
  }

  return fallback;
};

const getFallbackTierConfig = (tierName: string): MembershipTierVisualConfig => {
  const normalized = tierName.toLowerCase();

  if (normalized.includes('platinum')) {
    return {
      bgColor: '#1c1c1c',
      icon: 'diamond-stone',
      badgeColor: '#1c1c1c',
      textColor: '#e5e4e2',
    };
  }

  if (normalized.includes('gold')) {
    return {
      bgColor: '#cf9f2e',
      icon: 'crown',
      badgeColor: '#cf9f2e',
      textColor: '#ffffff',
    };
  }

  if (normalized.includes('silver')) {
    return {
      bgColor: '#8fa3ad',
      icon: 'shield-star',
      badgeColor: '#8fa3ad',
      textColor: '#ffffff',
    };
  }

  return {
    bgColor: '#5b788a',
    icon: 'star',
    badgeColor: '#5b788a',
    textColor: '#ffffff',
  };
};

export const getMembershipTierVisualConfig = (
  tier?: Pick<MembershipTier, 'name' | 'cardColor' | 'textColor' | 'badgeColor' | 'iconName'> | null,
): MembershipTierVisualConfig => {
  const fallback = getFallbackTierConfig(tier?.name ?? 'Member');
  const bgColor = normalizeColor(tier?.cardColor, fallback.bgColor);

  return {
    bgColor,
    icon: normalizeIconName(tier?.iconName, fallback.icon),
    badgeColor: normalizeColor(tier?.badgeColor, bgColor),
    textColor: normalizeColor(tier?.textColor, fallback.textColor),
  };
};
