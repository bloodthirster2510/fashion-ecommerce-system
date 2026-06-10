import { MembershipRanking } from '../../database/models';
import { resolveMembershipVisualConfig } from '../../database/membership-visual';

export const getMembershipRankings = async () => {
  const tiers = await MembershipRanking.find({ isActive: true }).sort({ level: 1 }).lean();

  return tiers.map((tier) => ({
    ...tier,
    ...resolveMembershipVisualConfig(tier),
  }));
};

const toMembershipTierResponse = (tier: {
  _id?: unknown;
  name: string;
  level: number;
  minPoint: number;
  maxPoint: number | null;
  discountPercent: number;
  benefitDescription: string;
  cardColor?: string | null;
  textColor?: string | null;
  badgeColor?: string | null;
  iconName?: string | null;
}) => ({
  _id: tier._id,
  name: tier.name,
  level: tier.level,
  minPoint: tier.minPoint,
  maxPoint: tier.maxPoint,
  discountPercent: tier.discountPercent,
  benefitDescription: tier.benefitDescription,
  ...resolveMembershipVisualConfig(tier),
});

export const getUserMembership = async (userId: string, loyaltyPoint: number) => {
  const tiers = await getMembershipRankings();

  let currentTier = tiers[0];
  let nextTier = null;

  for (let i = tiers.length - 1; i >= 0; i--) {
    if (loyaltyPoint >= tiers[i].minPoint) {
      currentTier = tiers[i];
      nextTier = tiers[i + 1] || null;
      break;
    }
  }

  let pointToNextTier = 0;
  let progressPercent = 0;

  if (nextTier) {
    pointToNextTier = nextTier.minPoint - loyaltyPoint;
    const tierRange = nextTier.minPoint - currentTier.minPoint;
    const progress = loyaltyPoint - currentTier.minPoint;
    progressPercent = tierRange > 0 ? Math.round((progress / tierRange) * 100) : 0;
  }

  return {
    currentTier: toMembershipTierResponse(currentTier),
    nextTier: nextTier
      ? toMembershipTierResponse(nextTier)
      : null,
    loyaltyPoint,
    pointToNextTier,
    progressPercent,
    tiers: tiers.map(toMembershipTierResponse),
  };
};
