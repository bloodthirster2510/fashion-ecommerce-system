import { LoyaltyPointHistory, Order, CouponUsage } from '../../../database/models';

type PromotionAnalyticsQuery = { from?: unknown; to?: unknown };

const parseDate = (value: unknown, fallback: Date, endOfDay = false) => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Invalid analytics date range'), { statusCode: 400 });
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
  return date;
};

const getPromotionAnalytics = async (query: PromotionAnalyticsQuery = {}) => {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDate(query.from, defaultFrom);
  const to = parseDate(query.to, now, true);
  if (to < from) throw Object.assign(new Error('Analytics end date must be after start date'), { statusCode: 400 });

  const [couponSummaryRows, topCoupons, orderSummaryRows, loyaltyRows, campaignRows] = await Promise.all([
    CouponUsage.aggregate([
      { $match: { usedAt: { $gte: from, $lte: to } } },
      { $group: {
        _id: null,
        usageCount: { $sum: 1 },
        productDiscount: { $sum: '$discountAmount' },
        shippingDiscount: { $sum: '$shippingDiscountAmount' },
      } },
    ]),
    CouponUsage.aggregate([
      { $match: { usedAt: { $gte: from, $lte: to } } },
      { $group: {
        _id: '$codeSnapshot',
        usageCount: { $sum: 1 },
        totalDiscount: { $sum: { $add: ['$discountAmount', '$shippingDiscountAmount'] } },
      } },
      { $sort: { usageCount: -1, totalDiscount: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: {
        createdAt: { $gte: from, $lte: to },
        status: { $nin: ['cancelled', 'returned'] },
      } },
      { $group: {
        _id: null,
        orderCount: { $sum: 1 },
        grossMerchandiseValue: { $sum: '$subTotal' },
        netRevenue: { $sum: '$totalAmount' },
        couponDiscount: { $sum: '$couponDiscountAmount' },
        membershipDiscount: { $sum: '$membershipDiscountAmount' },
      } },
    ]),
    LoyaltyPointHistory.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$type', transactionCount: { $sum: 1 }, points: { $sum: '$delta' } } },
    ]),
    Order.aggregate([
      { $match: {
        createdAt: { $gte: from, $lte: to },
        promotionCampaignId: { $ne: null },
        status: { $nin: ['cancelled', 'returned'] },
      } },
      { $group: {
        _id: '$promotionCampaignId',
        orderCount: { $sum: 1 },
        netRevenue: { $sum: '$totalAmount' },
        discountAmount: { $sum: { $add: ['$couponDiscountAmount', '$shippingDiscountAmount'] } },
      } },
      { $lookup: { from: 'promotion_campaigns', localField: '_id', foreignField: '_id', as: 'campaign' } },
      { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
      { $project: {
        campaignId: '$_id',
        code: '$campaign.code',
        name: '$campaign.name',
        orderCount: 1,
        netRevenue: 1,
        discountAmount: 1,
        _id: 0,
      } },
      { $sort: { netRevenue: -1 } },
    ]),
  ]);

  const couponSummary = couponSummaryRows[0] ?? { usageCount: 0, productDiscount: 0, shippingDiscount: 0 };
  const orderSummary = orderSummaryRows[0] ?? {
    orderCount: 0,
    grossMerchandiseValue: 0,
    netRevenue: 0,
    couponDiscount: 0,
    membershipDiscount: 0,
  };

  return {
    range: { from, to },
    orders: orderSummary,
    coupons: {
      ...couponSummary,
      totalDiscount: couponSummary.productDiscount + couponSummary.shippingDiscount,
      topCoupons: topCoupons.map((row) => ({ code: row._id, ...row, _id: undefined })),
    },
    loyalty: loyaltyRows.map((row) => ({ type: row._id, transactionCount: row.transactionCount, points: row.points })),
    campaigns: campaignRows,
  };
};

export const promotionAnalyticsService = { getPromotionAnalytics };
