import { MembershipRanking } from '../models/membership-ranking.model';
import { getMembershipVisualPreset } from '../membership-visual';

const backfillMembershipVisualConfig = async () => {
  const rankings = await MembershipRanking.find({
    $or: [
      { cardColor: { $exists: false } },
      { textColor: { $exists: false } },
      { badgeColor: { $exists: false } },
      { iconName: { $exists: false } },
    ],
  });

  for (const ranking of rankings) {
    const preset = getMembershipVisualPreset(ranking.level);
    const update: Partial<Record<'cardColor' | 'textColor' | 'badgeColor' | 'iconName', string>> = {};

    if (!ranking.cardColor) update.cardColor = preset.cardColor;
    if (!ranking.textColor) update.textColor = preset.textColor;
    if (!ranking.badgeColor) update.badgeColor = preset.badgeColor;
    if (!ranking.iconName) update.iconName = preset.iconName;

    if (Object.keys(update).length > 0) {
      await MembershipRanking.updateOne({ _id: ranking._id }, { $set: update });
    }
  }
};

export const seedMembershipRankings = async () => {
  const existing = await MembershipRanking.countDocuments();
  if (existing > 0) {
    await backfillMembershipVisualConfig();
    console.log('Membership rankings already seeded');
    return;
  }

  const rankings = [
    {
      name: 'Member',
      level: 1,
      minPoint: 0,
      maxPoint: 1999,
      discountPercent: 0,
      benefitDescription: 'Tích điểm đổi quà/voucher',
      cardColor: '#5b788a',
      textColor: '#ffffff',
      badgeColor: '#5b788a',
      iconName: 'star',
    },
    {
      name: 'Silver',
      level: 2,
      minPoint: 2000,
      maxPoint: 4999,
      discountPercent: 5,
      benefitDescription: 'Giảm 5% trên mỗi hóa đơn',
      cardColor: '#8fa3ad',
      textColor: '#ffffff',
      badgeColor: '#8fa3ad',
      iconName: 'shield-star',
    },
    {
      name: 'Gold',
      level: 3,
      minPoint: 5000,
      maxPoint: 9999,
      discountPercent: 7,
      benefitDescription: 'Giảm 7% trên mỗi hóa đơn',
      cardColor: '#cf9f2e',
      textColor: '#ffffff',
      badgeColor: '#cf9f2e',
      iconName: 'crown',
    },
    {
      name: 'Platinum',
      level: 4,
      minPoint: 10000,
      maxPoint: null,
      discountPercent: 10,
      benefitDescription: 'Giảm 10% trên mỗi hóa đơn',
      cardColor: '#1c1c1c',
      textColor: '#e5e4e2',
      badgeColor: '#1c1c1c',
      iconName: 'diamond-stone',
    },
  ];

  await MembershipRanking.insertMany(rankings);
  console.log('Seeded membership rankings');
};
