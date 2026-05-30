import { MembershipRanking } from '../../database/models';

export const getMembershipRankings = async () => {
  return MembershipRanking.find({ isActive: true }).sort({ level: 1 });
};

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
    currentTier: {
      _id: currentTier._id,
      name: currentTier.name,
      level: currentTier.level,
      minPoint: currentTier.minPoint,
      maxPoint: currentTier.maxPoint,
      discountPercent: currentTier.discountPercent,
      benefitDescription: currentTier.benefitDescription,
    },
    nextTier: nextTier
      ? {
          name: nextTier.name,
          level: nextTier.level,
          minPoint: nextTier.minPoint,
          discountPercent: nextTier.discountPercent,
          benefitDescription: nextTier.benefitDescription,
        }
      : null,
    loyaltyPoint,
    pointToNextTier,
    progressPercent,
    tiers: tiers.map((t) => ({
      name: t.name,
      level: t.level,
      minPoint: t.minPoint,
      maxPoint: t.maxPoint,
      discountPercent: t.discountPercent,
      benefitDescription: t.benefitDescription,
    })),
  };
};
