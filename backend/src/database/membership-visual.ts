export type MembershipVisualSource = {
  name?: string;
  level?: number;
  cardColor?: string | null;
  textColor?: string | null;
  badgeColor?: string | null;
  iconName?: string | null;
};

export type MembershipVisualConfig = {
  cardColor: string;
  textColor: string;
  badgeColor: string;
  iconName: string;
};

export const hexColorRegex = /^#([0-9a-fA-F]{6})$/;
export const iconNameRegex = /^[a-z0-9-]{2,60}$/;

const tierVisualPresets: MembershipVisualConfig[] = [
  { cardColor: '#5b788a', textColor: '#ffffff', badgeColor: '#5b788a', iconName: 'star' },
  { cardColor: '#8fa3ad', textColor: '#ffffff', badgeColor: '#8fa3ad', iconName: 'shield-star' },
  { cardColor: '#cf9f2e', textColor: '#ffffff', badgeColor: '#cf9f2e', iconName: 'crown' },
  { cardColor: '#1c1c1c', textColor: '#e5e4e2', badgeColor: '#1c1c1c', iconName: 'diamond-stone' },
];

const normalizeColor = (value: string | null | undefined, fallback: string) => {
  if (value && hexColorRegex.test(value)) {
    return value.toLowerCase();
  }

  return fallback;
};

const normalizeIconName = (value: string | null | undefined, fallback: string) => {
  if (value && iconNameRegex.test(value)) {
    return value.toLowerCase();
  }

  return fallback;
};

export const getMembershipVisualPreset = (level?: number) => {
  const presetIndex = Math.max(0, Math.min(tierVisualPresets.length - 1, (level ?? 1) - 1));

  return tierVisualPresets[presetIndex];
};

export const resolveMembershipVisualConfig = (
  tier: MembershipVisualSource,
): MembershipVisualConfig => {
  const fallback = getMembershipVisualPreset(tier.level);
  const cardColor = normalizeColor(tier.cardColor, fallback.cardColor);

  return {
    cardColor,
    textColor: normalizeColor(tier.textColor, fallback.textColor),
    badgeColor: normalizeColor(tier.badgeColor, cardColor),
    iconName: normalizeIconName(tier.iconName, fallback.iconName),
  };
};
