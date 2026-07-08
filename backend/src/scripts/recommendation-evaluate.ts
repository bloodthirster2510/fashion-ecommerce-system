import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { connectDB } from '../config/database';
import { Order, Product, RecommendationEvent } from '../database/models';
import { recommendationService } from '../modules/recommendations/recommendation.service';
import { toIdString } from '../modules/sales/sales.helpers';

dotenv.config();

const getNumberArg = (name: string, fallback: number) => {
  const prefix = `--${name}=`;
  const rawValue = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const getOnlineMetrics = async (days: number) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await RecommendationEvent.aggregate<{
    _id: { context: string; eventType: string };
    count: number;
  }>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { context: '$context', eventType: '$eventType' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.context': 1, '_id.eventType': 1 } },
  ]);
  const byContext = new Map<string, Record<string, number>>();

  rows.forEach((row) => {
    const current = byContext.get(row._id.context) ?? {};
    current[row._id.eventType] = row.count;
    byContext.set(row._id.context, current);
  });

  return [...byContext.entries()].map(([context, counts]) => {
    const impression = counts.impression ?? 0;

    return {
      context,
      impression,
      click: counts.click ?? 0,
      addToCart: counts.add_to_cart ?? 0,
      purchase: counts.purchase ?? 0,
      ctr: impression ? Number(((counts.click ?? 0) / impression).toFixed(4)) : 0,
      addToCartRate: impression ? Number(((counts.add_to_cart ?? 0) / impression).toFixed(4)) : 0,
      conversionRate: impression ? Number(((counts.purchase ?? 0) / impression).toFixed(4)) : 0,
    };
  });
};

const evaluateSimilarFromOrders = async (orderLimit: number, k: number) => {
  const orders = await Order.find({
    status: { $nin: ['cancelled', 'returned'] },
    'order_list.1': { $exists: true },
  })
    .select('orderCode order_list.productId createdAt')
    .sort({ createdAt: -1 })
    .limit(orderLimit)
    .lean<Array<{
      orderCode: string;
      order_list: Array<{ productId: Types.ObjectId }>;
    }>>();
  let cases = 0;
  let precisionSum = 0;
  let recallSum = 0;
  let averagePrecisionSum = 0;
  let ndcgSum = 0;
  let categoryDiversitySum = 0;
  let hits = 0;
  const uniqueRecommendedProductIds = new Set<string>();
  const activeProductCount = await Product.countDocuments({ isActive: true });

  for (const order of orders) {
    const productIds = Array.from(new Set(order.order_list.map((item) => toIdString(item.productId)).filter(Boolean)));

    for (const productId of productIds) {
      const relevantIds = new Set(productIds.filter((id) => id !== productId));
      if (!relevantIds.size) {
        continue;
      }

      try {
        const response = await recommendationService.getSimilarRecommendations({ productId, limit: k });
        const recommendedIds = response.items.map((item) => item.product._id);
        const hitCount = recommendedIds.filter((id) => relevantIds.has(id)).length;
        let cumulativeHits = 0;
        let averagePrecision = 0;
        let dcg = 0;

        recommendedIds.forEach((id, index) => {
          uniqueRecommendedProductIds.add(id);
          if (relevantIds.has(id)) {
            cumulativeHits += 1;
            averagePrecision += cumulativeHits / (index + 1);
            dcg += 1 / Math.log2(index + 2);
          }
        });

        const idealHitCount = Math.min(relevantIds.size, recommendedIds.length, k);
        const idealDcg = Array.from(
          { length: idealHitCount },
          (_, index) => 1 / Math.log2(index + 2),
        ).reduce((sum, value) => sum + value, 0);
        const categoryIds = new Set(
          response.items
            .map((item) => item.product.category?._id)
            .filter(Boolean),
        );

        cases += 1;
        hits += hitCount > 0 ? 1 : 0;
        precisionSum += recommendedIds.length ? hitCount / recommendedIds.length : 0;
        recallSum += hitCount / relevantIds.size;
        averagePrecisionSum += idealHitCount ? averagePrecision / idealHitCount : 0;
        ndcgSum += idealDcg ? dcg / idealDcg : 0;
        categoryDiversitySum += recommendedIds.length
          ? categoryIds.size / recommendedIds.length
          : 0;
      } catch {
        // Skip orders that reference products no longer available.
      }
    }
  }

  return {
    cases,
    hitRateAtK: cases ? Number((hits / cases).toFixed(4)) : 0,
    precisionAtK: cases ? Number((precisionSum / cases).toFixed(4)) : 0,
    recallAtK: cases ? Number((recallSum / cases).toFixed(4)) : 0,
    mapAtK: cases ? Number((averagePrecisionSum / cases).toFixed(4)) : 0,
    ndcgAtK: cases ? Number((ndcgSum / cases).toFixed(4)) : 0,
    catalogCoverage: activeProductCount
      ? Number((uniqueRecommendedProductIds.size / activeProductCount).toFixed(4))
      : 0,
    categoryDiversityAtK: cases
      ? Number((categoryDiversitySum / cases).toFixed(4))
      : 0,
  };
};

const run = async () => {
  await connectDB();

  const days = getNumberArg('days', 30);
  const orderLimit = getNumberArg('orders', 100);
  const k = getNumberArg('k', 8);
  const [online, similarOffline] = await Promise.all([
    getOnlineMetrics(days),
    evaluateSimilarFromOrders(orderLimit, k),
  ]);

  console.log(JSON.stringify({
    params: { days, orderLimit, k },
    online,
    similarOffline,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error('Recommendation evaluation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
