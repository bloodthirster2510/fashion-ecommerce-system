import {
  Product,
  RecommendationEvent,
  RecommendationRequest,
  RECOMMENDATION_CONTEXTS,
  SearchHistory,
  UserProductInteraction,
  type RecommendationContext,
  type RecommendationEventType,
} from '../../database/models';

type RecommendationAnalyticsQuery = {
  from?: unknown;
  to?: unknown;
  days?: unknown;
  context?: unknown;
  algorithmVersion?: unknown;
};

type AnalyticsFilter = {
  context?: RecommendationContext;
  algorithmVersion?: string;
};

type AnalyticsRange = {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
};

type EventCounts = {
  impressions: number;
  clicks: number;
  addToCarts: number;
  ordersCreated: number;
  paymentsCompleted: number;
  ordersCancelled: number;
  ordersReturned: number;
  reversedPayments: number;
  netPayments: number;
  grossAttributedRevenue: number;
  reversedAttributedRevenue: number;
  netAttributedRevenue: number;
};

type MetricSnapshot = EventCounts & {
  requests: number;
  recommendations: number;
  fallbackRequests: number;
  ctr: number;
  clickToCartRate: number;
  cartToOrderRate: number;
  orderToPaymentRate: number;
  paymentRate: number;
  netPaymentRate: number;
  fallbackRate: number;
};

type RequestSummaryRow = {
  requests: number;
  fallbackRequests: number;
  recommendations: number;
};

type EventSummaryRow = {
  _id: RecommendationEventType;
  count: number;
  amount: number;
  reversedCount: number;
  reversedAmount: number;
};

type SegmentRequestRow = RequestSummaryRow & {
  _id: {
    algorithmVersion: string;
    context: RecommendationContext;
  };
};

type SegmentEventRow = {
  _id: {
    algorithmVersion: string;
    context: RecommendationContext;
    eventType: RecommendationEventType;
  };
  count: number;
  amount: number;
  reversedCount: number;
  reversedAmount: number;
  avgRank: number | null;
  avgScore: number | null;
};

type TrendRequestRow = {
  _id: string;
  requests: number;
  fallbackRequests: number;
};

type TrendEventRow = {
  _id: {
    day: string;
    eventType: RecommendationEventType;
  };
  count: number;
  amount: number;
  reversedCount: number;
  reversedAmount: number;
};

type CoverageRow = {
  id: string;
  name: string;
  recommendedCount: number;
  requestCount: number;
};

type DiversityRow = {
  requestsSampled: number;
  averageCategoryDiversityAt10: number;
  averageBrandDiversityAt10: number;
};

type SearchSummaryRow = {
  totalSearches: number;
  keywordSearches: number;
  imageSearches: number;
  zeroResultSearches: number;
  totalResultCount: number;
};

type SearchKeywordRow = {
  keyword: string;
  count: number;
  averageResultCount: number;
  lastSearchedAt: Date;
};

type SearchTrendRow = {
  _id: string;
  searches: number;
  zeroResultSearches: number;
};

type TopProductRow = {
  productId: string;
  name: string;
  image: string | null;
  context: RecommendationContext[];
  clicks: number;
  addToCarts: number;
  ordersCreated: number;
  paymentsCompleted: number;
  netPayments: number;
  netAttributedRevenue: number;
};

type RecentRequestDocument = {
  requestId: string;
  context: RecommendationContext;
  algorithmVersion: string;
  fallbackUsed: boolean;
  items: unknown[];
  createdAt: Date;
};

type RecentRequestEventRow = {
  _id: {
    requestId: string;
    eventType: RecommendationEventType;
  };
  count: number;
  amount: number;
  reversedCount: number;
  reversedAmount: number;
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const BANGKOK_OFFSET = '+07:00';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECENT_REQUEST_LIMIT = 12;

const emptyEventCounts = (): EventCounts => ({
  impressions: 0,
  clicks: 0,
  addToCarts: 0,
  ordersCreated: 0,
  paymentsCompleted: 0,
  ordersCancelled: 0,
  ordersReturned: 0,
  reversedPayments: 0,
  netPayments: 0,
  grossAttributedRevenue: 0,
  reversedAttributedRevenue: 0,
  netAttributedRevenue: 0,
});

const applyEventSummary = (counts: EventCounts, row: EventSummaryRow) => {
  switch (row._id) {
    case 'impression':
      counts.impressions += row.count;
      break;
    case 'click':
      counts.clicks += row.count;
      break;
    case 'add_to_cart':
      counts.addToCarts += row.count;
      break;
    case 'purchase':
    case 'order_created':
      // purchase is the v1 event written at order creation.
      counts.ordersCreated += row.count;
      break;
    case 'payment_completed':
      counts.paymentsCompleted += row.count;
      counts.grossAttributedRevenue += row.amount;
      break;
    case 'order_cancelled':
      counts.ordersCancelled += row.count;
      counts.reversedPayments += row.reversedCount;
      counts.reversedAttributedRevenue += row.reversedAmount;
      break;
    case 'order_returned':
      counts.ordersReturned += row.count;
      counts.reversedPayments += row.reversedCount;
      counts.reversedAttributedRevenue += row.reversedAmount;
      break;
  }

  counts.netPayments = counts.paymentsCompleted - counts.reversedPayments;
  counts.netAttributedRevenue = (
    counts.grossAttributedRevenue - counts.reversedAttributedRevenue
  );
};

export const calculateAnalyticsRate = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10000) / 10000;
};

export const calculateAnalyticsChangePercent = (value: number, previousValue: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(previousValue)) {
    return null;
  }

  if (previousValue === 0) {
    return value === 0 ? 0 : null;
  }

  return Math.round(((value - previousValue) / Math.abs(previousValue)) * 1000) / 10;
};

const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const bangkokDateKey = (value: Date) => bangkokDateFormatter.format(value);

const bangkokDayStart = (value: Date) => (
  new Date(`${bangkokDateKey(value)}T00:00:00${BANGKOK_OFFSET}`)
);

export const recommendationAnalyticsDayExpression = (dateExpression: string) => ({
  $dateToString: {
    date: dateExpression,
    format: '%Y-%m-%d',
    timezone: BANGKOK_TIME_ZONE,
  },
});

type CoverageDimension = 'category_id' | 'brand_id';

export const buildActiveCoverageProductFilter = (
  dimension: CoverageDimension,
  joinedProduct = false,
) => {
  const prefix = joinedProduct ? 'product.' : '';
  return {
    [`${prefix}isActive`]: true,
    [`${prefix}${dimension}`]: { $exists: true, $ne: null },
  };
};

const parseDate = (value: unknown, fallback: Date, endOfDay = false) => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const normalized = value.trim();
  const isDateOnly = DATE_ONLY_PATTERN.test(normalized);
  const date = isDateOnly
    ? new Date(`${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}${BANGKOK_OFFSET}`)
    : new Date(normalized);
  if (Number.isNaN(date.getTime()) || (isDateOnly && bangkokDateKey(date) !== normalized)) {
    throw Object.assign(new Error('Invalid recommendation analytics date range'), { statusCode: 400 });
  }

  return date;
};

const parseDays = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_DAYS;
  }

  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw Object.assign(new Error(`Recommendation analytics days must be from 1 to ${MAX_DAYS}`), {
      statusCode: 400,
    });
  }

  return days;
};

const parseOptionalText = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw Object.assign(new Error('Invalid recommendation analytics filter'), { statusCode: 400 });
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw Object.assign(new Error('Invalid recommendation analytics filter'), { statusCode: 400 });
  }

  return normalized;
};

export const normalizeRecommendationAnalyticsQuery = (
  query: RecommendationAnalyticsQuery = {},
  now = new Date(),
) => {
  const days = parseDays(query.days);
  const defaultFrom = new Date(bangkokDayStart(now).getTime() - (days - 1) * DAY_MS);
  const from = parseDate(query.from, defaultFrom);
  const to = parseDate(query.to, now, true);

  if (to < from) {
    throw Object.assign(new Error('Recommendation analytics end date must be after start date'), {
      statusCode: 400,
    });
  }

  const duration = to.getTime() - from.getTime();
  if (duration > MAX_DAYS * DAY_MS) {
    throw Object.assign(
      new Error(`Recommendation analytics date range cannot exceed ${MAX_DAYS} days`),
      { statusCode: 400 },
    );
  }

  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);
  const context = parseOptionalText(query.context, 80);
  const algorithmVersion = parseOptionalText(query.algorithmVersion, 80);

  if (context && !RECOMMENDATION_CONTEXTS.includes(context as RecommendationContext)) {
    throw Object.assign(new Error('Invalid recommendation context'), { statusCode: 400 });
  }

  return {
    range: { from, to, previousFrom, previousTo },
    filters: {
      ...(context ? { context: context as RecommendationContext } : {}),
      ...(algorithmVersion ? { algorithmVersion } : {}),
    },
  };
};

const buildRequestFilter = (range: Pick<AnalyticsRange, 'from' | 'to'>, filters: AnalyticsFilter) => ({
  createdAt: { $gte: range.from, $lte: range.to },
  ...(filters.context ? { context: filters.context } : {}),
  ...(filters.algorithmVersion ? { algorithmVersion: filters.algorithmVersion } : {}),
});

const buildEventFilter = (range: Pick<AnalyticsRange, 'from' | 'to'>, filters: AnalyticsFilter) => ({
  createdAt: { $gte: range.from, $lte: range.to },
  ...(filters.context ? { context: filters.context } : {}),
  ...(filters.algorithmVersion ? { algorithmVersion: filters.algorithmVersion } : {}),
});

const refreshMetricRates = (metrics: MetricSnapshot) => {
  metrics.ctr = calculateAnalyticsRate(metrics.clicks, metrics.impressions);
  metrics.clickToCartRate = calculateAnalyticsRate(metrics.addToCarts, metrics.clicks);
  metrics.cartToOrderRate = calculateAnalyticsRate(metrics.ordersCreated, metrics.addToCarts);
  metrics.orderToPaymentRate = calculateAnalyticsRate(
    metrics.paymentsCompleted,
    metrics.ordersCreated,
  );
  metrics.paymentRate = calculateAnalyticsRate(metrics.paymentsCompleted, metrics.impressions);
  metrics.netPaymentRate = calculateAnalyticsRate(metrics.netPayments, metrics.impressions);
  metrics.fallbackRate = calculateAnalyticsRate(metrics.fallbackRequests, metrics.requests);
};

export const toMetricSnapshot = (
  requestSummary: RequestSummaryRow | undefined,
  eventRows: EventSummaryRow[],
): MetricSnapshot => {
  const counts = emptyEventCounts();
  eventRows.forEach((row) => applyEventSummary(counts, row));

  const requests = requestSummary?.requests ?? 0;
  const fallbackRequests = requestSummary?.fallbackRequests ?? 0;
  const metrics: MetricSnapshot = {
    requests,
    recommendations: requestSummary?.recommendations ?? 0,
    fallbackRequests,
    ...counts,
    ctr: 0,
    clickToCartRate: 0,
    cartToOrderRate: 0,
    orderToPaymentRate: 0,
    paymentRate: 0,
    netPaymentRate: 0,
    fallbackRate: 0,
  };

  refreshMetricRates(metrics);
  return metrics;
};

const collectMetricSnapshot = async (
  range: Pick<AnalyticsRange, 'from' | 'to'>,
  filters: AnalyticsFilter,
) => {
  const requestFilter = buildRequestFilter(range, filters);
  const eventFilter = buildEventFilter(range, filters);

  const [requestRows, eventRows] = await Promise.all([
    RecommendationRequest.aggregate<RequestSummaryRow>([
      { $match: requestFilter },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          fallbackRequests: { $sum: { $cond: ['$fallbackUsed', 1, 0] } },
          recommendations: { $sum: { $size: { $ifNull: ['$items', []] } } },
        },
      },
      { $project: { _id: 0, requests: 1, fallbackRequests: 1, recommendations: 1 } },
    ]),
    RecommendationEvent.aggregate<EventSummaryRow>([
      { $match: eventFilter },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$attributedAmount', 0] } },
          reversedCount: { $sum: { $cond: ['$reversesPayment', 1, 0] } },
          reversedAmount: {
            $sum: { $cond: ['$reversesPayment', { $ifNull: ['$attributedAmount', 0] }, 0] },
          },
        },
      },
    ]),
  ]);

  return toMetricSnapshot(requestRows[0], eventRows);
};

const segmentKey = (algorithmVersion: string, context: RecommendationContext) =>
  `${algorithmVersion}\u0000${context}`;

const collectSegments = async (range: Pick<AnalyticsRange, 'from' | 'to'>, filters: AnalyticsFilter) => {
  const [requestRows, eventRows] = await Promise.all([
    RecommendationRequest.aggregate<SegmentRequestRow>([
      { $match: buildRequestFilter(range, filters) },
      {
        $group: {
          _id: {
            algorithmVersion: '$algorithmVersion',
            context: '$context',
          },
          requests: { $sum: 1 },
          fallbackRequests: { $sum: { $cond: ['$fallbackUsed', 1, 0] } },
          recommendations: { $sum: { $size: { $ifNull: ['$items', []] } } },
        },
      },
    ]),
    RecommendationEvent.aggregate<SegmentEventRow>([
      { $match: buildEventFilter(range, filters) },
      {
        $group: {
          _id: {
            algorithmVersion: '$algorithmVersion',
            context: '$context',
            eventType: '$eventType',
          },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$attributedAmount', 0] } },
          reversedCount: { $sum: { $cond: ['$reversesPayment', 1, 0] } },
          reversedAmount: {
            $sum: { $cond: ['$reversesPayment', { $ifNull: ['$attributedAmount', 0] }, 0] },
          },
          avgRank: { $avg: '$rank' },
          avgScore: { $avg: '$score' },
        },
      },
    ]),
  ]);

  const segments = new Map<string, {
    algorithmVersion: string;
    context: RecommendationContext;
    metrics: MetricSnapshot;
    avgClickRank: number | null;
    avgClickScore: number | null;
  }>();

  requestRows.forEach((row) => {
    const key = segmentKey(row._id.algorithmVersion, row._id.context);
    segments.set(key, {
      algorithmVersion: row._id.algorithmVersion,
      context: row._id.context,
      metrics: toMetricSnapshot(row, []),
      avgClickRank: null,
      avgClickScore: null,
    });
  });

  eventRows.forEach((row) => {
    const key = segmentKey(row._id.algorithmVersion, row._id.context);
    const current = segments.get(key) ?? {
      algorithmVersion: row._id.algorithmVersion,
      context: row._id.context,
      metrics: toMetricSnapshot(undefined, []),
      avgClickRank: null,
      avgClickScore: null,
    };
    applyEventSummary(current.metrics, {
      _id: row._id.eventType,
      count: row.count,
      amount: row.amount,
      reversedCount: row.reversedCount,
      reversedAmount: row.reversedAmount,
    });
    if (row._id.eventType === 'click') {
      current.avgClickRank = row.avgRank === null ? null : Math.round(row.avgRank * 10) / 10;
      current.avgClickScore = row.avgScore === null ? null : Math.round(row.avgScore * 1000) / 1000;
    }
    refreshMetricRates(current.metrics);
    segments.set(key, current);
  });

  return Array.from(segments.values())
    .sort((left, right) =>
      right.metrics.impressions - left.metrics.impressions ||
      right.metrics.requests - left.metrics.requests ||
      left.algorithmVersion.localeCompare(right.algorithmVersion) ||
      left.context.localeCompare(right.context),
    );
};

const buildDayBuckets = (range: Pick<AnalyticsRange, 'from' | 'to'>) => {
  const buckets = new Map<string, MetricSnapshot>();
  const cursor = bangkokDayStart(range.from);
  const end = bangkokDayStart(range.to);

  while (cursor <= end) {
    buckets.set(bangkokDateKey(cursor), toMetricSnapshot(undefined, []));
    cursor.setTime(cursor.getTime() + DAY_MS);
  }

  return buckets;
};

const collectTrend = async (range: Pick<AnalyticsRange, 'from' | 'to'>, filters: AnalyticsFilter) => {
  const buckets = buildDayBuckets(range);
  const [requestRows, eventRows] = await Promise.all([
    RecommendationRequest.aggregate<TrendRequestRow>([
      { $match: buildRequestFilter(range, filters) },
      {
        $group: {
          _id: recommendationAnalyticsDayExpression('$createdAt'),
          requests: { $sum: 1 },
          fallbackRequests: { $sum: { $cond: ['$fallbackUsed', 1, 0] } },
        },
      },
    ]),
    RecommendationEvent.aggregate<TrendEventRow>([
      { $match: buildEventFilter(range, filters) },
      {
        $group: {
          _id: {
            day: recommendationAnalyticsDayExpression('$createdAt'),
            eventType: '$eventType',
          },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$attributedAmount', 0] } },
          reversedCount: { $sum: { $cond: ['$reversesPayment', 1, 0] } },
          reversedAmount: {
            $sum: { $cond: ['$reversesPayment', { $ifNull: ['$attributedAmount', 0] }, 0] },
          },
        },
      },
    ]),
  ]);

  requestRows.forEach((row) => {
    const current = buckets.get(row._id) ?? toMetricSnapshot(undefined, []);
    current.requests = row.requests;
    current.fallbackRequests = row.fallbackRequests;
    refreshMetricRates(current);
    buckets.set(row._id, current);
  });

  eventRows.forEach((row) => {
    const current = buckets.get(row._id.day) ?? toMetricSnapshot(undefined, []);
    applyEventSummary(current, {
      _id: row._id.eventType,
      count: row.count,
      amount: row.amount,
      reversedCount: row.reversedCount,
      reversedAmount: row.reversedAmount,
    });
    refreshMetricRates(current);
    buckets.set(row._id.day, current);
  });

  return Array.from(buckets.entries()).map(([date, metrics]) => ({ date, ...metrics }));
};

const collectCoverageBreakdown = async (
  range: Pick<AnalyticsRange, 'from' | 'to'>,
  filters: AnalyticsFilter,
) => {
  const requestFilter = buildRequestFilter(range, filters);
  const [activeCategoryRows, activeBrandRows, categoryRows, brandRows] = await Promise.all([
    Product.aggregate<{ _id: string }>([
      { $match: buildActiveCoverageProductFilter('category_id') },
      { $group: { _id: '$category_id' } },
    ]),
    Product.aggregate<{ _id: string }>([
      { $match: buildActiveCoverageProductFilter('brand_id') },
      { $group: { _id: '$brand_id' } },
    ]),
    RecommendationRequest.aggregate<CoverageRow>([
      { $match: requestFilter },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: buildActiveCoverageProductFilter('category_id', true) },
      {
        $group: {
          _id: '$product.category_id',
          recommendedCount: { $sum: 1 },
          requestIds: { $addToSet: '$requestId' },
        },
      },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          name: { $ifNull: [{ $arrayElemAt: ['$category.name', 0] }, 'Không rõ danh mục'] },
          recommendedCount: 1,
          requestCount: { $size: '$requestIds' },
        },
      },
      { $sort: { recommendedCount: -1, name: 1 } },
    ]),
    RecommendationRequest.aggregate<CoverageRow>([
      { $match: requestFilter },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: buildActiveCoverageProductFilter('brand_id', true) },
      {
        $group: {
          _id: '$product.brand_id',
          recommendedCount: { $sum: 1 },
          requestIds: { $addToSet: '$requestId' },
        },
      },
      { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          name: { $ifNull: [{ $arrayElemAt: ['$brand.name', 0] }, 'Không rõ thương hiệu'] },
          recommendedCount: 1,
          requestCount: { $size: '$requestIds' },
        },
      },
      { $sort: { recommendedCount: -1, name: 1 } },
    ]),
  ]);

  return {
    categories: {
      uniqueRecommended: categoryRows.length,
      totalActive: activeCategoryRows.length,
      coverageRate: calculateAnalyticsRate(categoryRows.length, activeCategoryRows.length),
      top: categoryRows.slice(0, 10),
    },
    brands: {
      uniqueRecommended: brandRows.length,
      totalActive: activeBrandRows.length,
      coverageRate: calculateAnalyticsRate(brandRows.length, activeBrandRows.length),
      top: brandRows.slice(0, 10),
    },
  };
};

const collectDiversity = async (
  range: Pick<AnalyticsRange, 'from' | 'to'>,
  filters: AnalyticsFilter,
) => {
  const rows = await RecommendationRequest.aggregate<DiversityRow>([
    { $match: buildRequestFilter(range, filters) },
    {
      $project: {
        requestId: 1,
        topItems: { $slice: [{ $ifNull: ['$items', []] }, 10] },
      },
    },
    { $unwind: '$topItems' },
    { $lookup: { from: 'products', localField: 'topItems.productId', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$requestId',
        itemCount: { $sum: 1 },
        categoryIds: { $addToSet: '$product.category_id' },
        brandIds: { $addToSet: '$product.brand_id' },
      },
    },
    {
      $project: {
        categoryDiversity: {
          $cond: [
            { $gt: ['$itemCount', 0] },
            { $divide: [{ $size: '$categoryIds' }, '$itemCount'] },
            0,
          ],
        },
        brandDiversity: {
          $cond: [
            { $gt: ['$itemCount', 0] },
            { $divide: [{ $size: '$brandIds' }, '$itemCount'] },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        requestsSampled: { $sum: 1 },
        averageCategoryDiversityAt10: { $avg: '$categoryDiversity' },
        averageBrandDiversityAt10: { $avg: '$brandDiversity' },
      },
    },
    { $project: { _id: 0, requestsSampled: 1, averageCategoryDiversityAt10: 1, averageBrandDiversityAt10: 1 } },
  ]);

  const row = rows[0];
  return {
    requestsSampled: row?.requestsSampled ?? 0,
    averageCategoryDiversityAt10: row
      ? Math.round(row.averageCategoryDiversityAt10 * 10000) / 10000
      : 0,
    averageBrandDiversityAt10: row
      ? Math.round(row.averageBrandDiversityAt10 * 10000) / 10000
      : 0,
  };
};

const collectSearchReport = async (range: Pick<AnalyticsRange, 'from' | 'to'>) => {
  const searchFilter = { createdAt: { $gte: range.from, $lte: range.to } };
  const interactionFilter = {
    createdAt: { $gte: range.from, $lte: range.to },
    actionType: 'search_result_click',
  };

  const [summaryRows, topKeywords, trendRows, searchResultClicks] = await Promise.all([
    SearchHistory.aggregate<SearchSummaryRow>([
      { $match: searchFilter },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          keywordSearches: { $sum: { $cond: [{ $eq: ['$searchType', 'keyword'] }, 1, 0] } },
          imageSearches: { $sum: { $cond: [{ $eq: ['$searchType', 'image'] }, 1, 0] } },
          zeroResultSearches: { $sum: { $cond: [{ $eq: ['$resultCount', 0] }, 1, 0] } },
          totalResultCount: { $sum: '$resultCount' },
        },
      },
      { $project: { _id: 0 } },
    ]),
    SearchHistory.aggregate<SearchKeywordRow>([
      {
        $match: {
          ...searchFilter,
          searchType: 'keyword',
          keyword: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: { $toLower: '$keyword' },
          keyword: { $first: '$keyword' },
          count: { $sum: 1 },
          averageResultCount: { $avg: '$resultCount' },
          lastSearchedAt: { $max: '$createdAt' },
        },
      },
      { $sort: { count: -1, lastSearchedAt: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, keyword: 1, count: 1, averageResultCount: 1, lastSearchedAt: 1 } },
    ]),
    SearchHistory.aggregate<SearchTrendRow>([
      { $match: searchFilter },
      {
        $group: {
          _id: recommendationAnalyticsDayExpression('$createdAt'),
          searches: { $sum: 1 },
          zeroResultSearches: { $sum: { $cond: [{ $eq: ['$resultCount', 0] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    UserProductInteraction.countDocuments(interactionFilter),
  ]);

  const summary = summaryRows[0] ?? {
    totalSearches: 0,
    keywordSearches: 0,
    imageSearches: 0,
    zeroResultSearches: 0,
    totalResultCount: 0,
  };

  return {
    totalSearches: summary.totalSearches,
    keywordSearches: summary.keywordSearches,
    imageSearches: summary.imageSearches,
    searchResultClicks,
    searchClickRate: calculateAnalyticsRate(searchResultClicks, summary.totalSearches),
    zeroResultRate: calculateAnalyticsRate(summary.zeroResultSearches, summary.totalSearches),
    averageResultCount: summary.totalSearches
      ? Math.round((summary.totalResultCount / summary.totalSearches) * 10) / 10
      : 0,
    topKeywords: topKeywords.map((keyword) => ({
      ...keyword,
      averageResultCount: Math.round(keyword.averageResultCount * 10) / 10,
    })),
    trend: trendRows.map((row) => ({
      date: row._id,
      searches: row.searches,
      zeroResultSearches: row.zeroResultSearches,
      zeroResultRate: calculateAnalyticsRate(row.zeroResultSearches, row.searches),
    })),
  };
};

const collectTopProducts = async (
  range: Pick<AnalyticsRange, 'from' | 'to'>,
  filters: AnalyticsFilter,
) => RecommendationEvent.aggregate<TopProductRow>([
  {
    $match: {
      ...buildEventFilter(range, filters),
      eventType: {
        $in: [
          'click',
          'add_to_cart',
          'purchase',
          'order_created',
          'payment_completed',
          'order_cancelled',
          'order_returned',
        ],
      },
    },
  },
  {
    $group: {
      _id: '$recommendedProductId',
      context: { $addToSet: '$context' },
      clicks: { $sum: { $cond: [{ $eq: ['$eventType', 'click'] }, 1, 0] } },
      addToCarts: { $sum: { $cond: [{ $eq: ['$eventType', 'add_to_cart'] }, 1, 0] } },
      ordersCreated: {
        $sum: { $cond: [{ $in: ['$eventType', ['purchase', 'order_created']] }, 1, 0] },
      },
      paymentsCompleted: {
        $sum: { $cond: [{ $eq: ['$eventType', 'payment_completed'] }, 1, 0] },
      },
      reversedPayments: {
        $sum: {
          $cond: [
            {
              $and: [
                { $in: ['$eventType', ['order_cancelled', 'order_returned']] },
                '$reversesPayment',
              ],
            },
            1,
            0,
          ],
        },
      },
      grossAttributedRevenue: {
        $sum: {
          $cond: [
            { $eq: ['$eventType', 'payment_completed'] },
            { $ifNull: ['$attributedAmount', 0] },
            0,
          ],
        },
      },
      reversedAttributedRevenue: {
        $sum: {
          $cond: [
            {
              $and: [
                { $in: ['$eventType', ['order_cancelled', 'order_returned']] },
                '$reversesPayment',
              ],
            },
            { $ifNull: ['$attributedAmount', 0] },
            0,
          ],
        },
      },
    },
  },
  { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
  { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      productId: { $toString: '$_id' },
      name: { $ifNull: ['$product.name', 'Sản phẩm không còn trong catalog'] },
      image: { $ifNull: ['$product.product_image', null] },
      context: 1,
      clicks: 1,
      addToCarts: 1,
      ordersCreated: 1,
      paymentsCompleted: 1,
      netPayments: { $subtract: ['$paymentsCompleted', '$reversedPayments'] },
      netAttributedRevenue: {
        $subtract: ['$grossAttributedRevenue', '$reversedAttributedRevenue'],
      },
    },
  },
  { $sort: { paymentsCompleted: -1, ordersCreated: -1, addToCarts: -1, clicks: -1, name: 1 } },
  { $limit: 8 },
]);

const collectRecentRequests = async (
  range: Pick<AnalyticsRange, 'from' | 'to'>,
  filters: AnalyticsFilter,
) => {
  const requests = await RecommendationRequest.find(buildRequestFilter(range, filters))
    .sort({ createdAt: -1 })
    .limit(RECENT_REQUEST_LIMIT)
    .select('requestId context algorithmVersion fallbackUsed items createdAt')
    .lean<RecentRequestDocument[]>();
  const requestIds = requests.map((request) => request.requestId);

  if (!requestIds.length) {
    return [];
  }

  const eventRows = await RecommendationEvent.aggregate<RecentRequestEventRow>([
    { $match: { requestId: { $in: requestIds } } },
    {
      $group: {
        _id: {
          requestId: '$requestId',
          eventType: '$eventType',
        },
        count: { $sum: 1 },
        amount: { $sum: { $ifNull: ['$attributedAmount', 0] } },
        reversedCount: { $sum: { $cond: ['$reversesPayment', 1, 0] } },
        reversedAmount: {
          $sum: { $cond: ['$reversesPayment', { $ifNull: ['$attributedAmount', 0] }, 0] },
        },
      },
    },
  ]);
  const countsByRequest = new Map<string, EventCounts>();
  eventRows.forEach((row) => {
    const counts = countsByRequest.get(row._id.requestId) ?? emptyEventCounts();
    applyEventSummary(counts, {
      _id: row._id.eventType,
      count: row.count,
      amount: row.amount,
      reversedCount: row.reversedCount,
      reversedAmount: row.reversedAmount,
    });
    countsByRequest.set(row._id.requestId, counts);
  });

  return requests.map((request) => {
    const counts = countsByRequest.get(request.requestId) ?? emptyEventCounts();
    return {
      requestId: request.requestId,
      context: request.context,
      algorithmVersion: request.algorithmVersion,
      fallbackUsed: request.fallbackUsed,
      itemCount: Array.isArray(request.items) ? request.items.length : 0,
      createdAt: request.createdAt,
      ...counts,
      ctr: calculateAnalyticsRate(counts.clicks, counts.impressions),
    };
  });
};

const getComparison = (current: MetricSnapshot, previous: MetricSnapshot) => ({
  requestsPercent: calculateAnalyticsChangePercent(current.requests, previous.requests),
  impressionsPercent: calculateAnalyticsChangePercent(current.impressions, previous.impressions),
  clicksPercent: calculateAnalyticsChangePercent(current.clicks, previous.clicks),
  addToCartsPercent: calculateAnalyticsChangePercent(current.addToCarts, previous.addToCarts),
  ordersCreatedPercent: calculateAnalyticsChangePercent(current.ordersCreated, previous.ordersCreated),
  paymentsCompletedPercent: calculateAnalyticsChangePercent(
    current.paymentsCompleted,
    previous.paymentsCompleted,
  ),
  netAttributedRevenuePercent: calculateAnalyticsChangePercent(
    current.netAttributedRevenue,
    previous.netAttributedRevenue,
  ),
  ctrPercent: calculateAnalyticsChangePercent(current.ctr, previous.ctr),
  fallbackRatePercent: calculateAnalyticsChangePercent(current.fallbackRate, previous.fallbackRate),
});

const getRecommendationAnalytics = async (query: RecommendationAnalyticsQuery = {}) => {
  const { range, filters } = normalizeRecommendationAnalyticsQuery(query);
  const currentRange = { from: range.from, to: range.to };
  const previousRange = { from: range.previousFrom, to: range.previousTo };

  const [
    summary,
    previousSummary,
    segments,
    trend,
    coverage,
    diversity,
    search,
    topProducts,
    recentRequests,
  ] = await Promise.all([
    collectMetricSnapshot(currentRange, filters),
    collectMetricSnapshot(previousRange, filters),
    collectSegments(currentRange, filters),
    collectTrend(currentRange, filters),
    collectCoverageBreakdown(currentRange, filters),
    collectDiversity(currentRange, filters),
    collectSearchReport(currentRange),
    collectTopProducts(currentRange, filters),
    collectRecentRequests(currentRange, filters),
  ]);

  return {
    generatedAt: new Date(),
    range: {
      from: range.from,
      to: range.to,
      previousFrom: range.previousFrom,
      previousTo: range.previousTo,
    },
    filters,
    summary,
    comparison: getComparison(summary, previousSummary),
    segments,
    trend,
    coverage,
    diversity,
    search,
    topProducts,
    recentRequests,
  };
};

export const recommendationAnalyticsService = {
  getRecommendationAnalytics,
};
