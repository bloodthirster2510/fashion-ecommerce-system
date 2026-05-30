import { MembershipRanking } from '../models/membership-ranking.model';

export const seedMembershipRankings = async () => {
  const existing = await MembershipRanking.countDocuments();
  if (existing > 0) {
    console.log('Membership rankings already seeded');
    return;
  }

  const rankings = [
    { name: 'Member', level: 1, minPoint: 0, maxPoint: 1999, discountPercent: 0, benefitDescription: 'Tích điểm đổi quà/voucher' },
    { name: 'Silver', level: 2, minPoint: 2000, maxPoint: 4999, discountPercent: 5, benefitDescription: 'Giảm 5% trên mỗi hóa đơn' },
    { name: 'Gold', level: 3, minPoint: 5000, maxPoint: 9999, discountPercent: 7, benefitDescription: 'Giảm 7% trên mỗi hóa đơn' },
    { name: 'Platinum', level: 4, minPoint: 10000, maxPoint: null, discountPercent: 10, benefitDescription: 'Giảm 10% trên mỗi hóa đơn' },
  ];

  await MembershipRanking.insertMany(rankings);
  console.log('Seeded membership rankings');
};
