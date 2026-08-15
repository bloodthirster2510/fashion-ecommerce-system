import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type {
  RecommendationBenchmarkCandidate,
  RecommendationBenchmarkCase,
  RecommendationBenchmarkDataset,
} from '../modules/recommendations/recommendation-benchmark';

type ReviewRow = {
  rating?: number;
  parent_asin?: string;
  user_id?: string;
  timestamp?: number;
  verified_purchase?: boolean;
};

type ProductMetadataRow = {
  title?: string;
  average_rating?: number;
  rating_number?: number;
  price?: number | null;
  store?: string | null;
  categories?: string[];
  details?: Record<string, string>;
  parent_asin?: string;
};

type PositiveInteraction = {
  productId: string;
  timestamp: number;
};

type OutfitRole = 'top' | 'bottom' | 'dress' | 'set' | 'shoes' | 'accessory' | 'outerwear';

type ProductFeature = {
  productId: string;
  categoryId: string;
  brandId: string | null;
  role: OutfitRole;
  gender: 'men' | 'women' | 'unisex' | null;
  colors: Set<string>;
  priceBucket: string | null;
};

type DraftCase = {
  caseId: string;
  context: RecommendationBenchmarkCase['context'];
  historyProductIds: string[];
  sourceProductIds: string[];
  relevantProductId: string;
  excludedProductIds: Set<string>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const POSITIVE_RATING = 4;
const DEFAULT_TEST_DAYS = 365;
const DEFAULT_CASES_PER_CONTEXT = 100;
const DEFAULT_CANDIDATES_PER_CASE = 200;
const DEFAULT_CATALOG_SIZE = 5000;
const MIN_USER_POSITIVE_INTERACTIONS = 5;

const CART_ROLE_COMPATIBILITY: Record<OutfitRole, Record<OutfitRole, number>> = {
  top: { top: 0.1, bottom: 1, dress: 0.15, set: 0.2, shoes: 0.55, accessory: 0.55, outerwear: 0.7 },
  bottom: { top: 1, bottom: 0.1, dress: 0.15, set: 0.2, shoes: 0.75, accessory: 0.5, outerwear: 0.65 },
  dress: { top: 0.2, bottom: 0.2, dress: 0.1, set: 0.15, shoes: 1, accessory: 0.7, outerwear: 0.8 },
  set: { top: 0.2, bottom: 0.2, dress: 0.15, set: 0.1, shoes: 1, accessory: 0.7, outerwear: 0.8 },
  shoes: { top: 0.8, bottom: 0.85, dress: 0.9, set: 0.9, shoes: 0.1, accessory: 0.4, outerwear: 0.6 },
  accessory: { top: 0.75, bottom: 0.7, dress: 0.8, set: 0.8, shoes: 0.5, accessory: 0.1, outerwear: 0.6 },
  outerwear: { top: 1, bottom: 0.9, dress: 0.8, set: 0.8, shoes: 0.65, accessory: 0.5, outerwear: 0.1 },
};

const COLOR_WORDS = [
  'black', 'white', 'blue', 'navy', 'red', 'green', 'yellow', 'pink', 'purple',
  'brown', 'beige', 'gray', 'grey', 'orange', 'gold', 'silver', 'khaki', 'cream',
];

const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const getPositiveIntegerArg = (name: string, fallback: number) => {
  const value = Number(getStringArg(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

const parseDateArg = (name: string, value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${name} must be a valid ISO-8601 date`);
  return timestamp;
};

const forEachJsonLine = async <T>(filePath: string, callback: (row: T) => void) => {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;

  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      callback(JSON.parse(line) as T);
    } catch (error) {
      throw new Error(`${filePath}:${lineNumber}: invalid JSON: ${String(error)}`);
    }
  }
};

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const hashValue = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const deterministicOrder = <T>(values: T[], getKey: (value: T) => string) => (
  [...values].sort((left, right) => hashValue(getKey(left)).localeCompare(hashValue(getKey(right))))
);

const isPositiveReview = (row: ReviewRow) => (
  row.verified_purchase === true &&
  typeof row.rating === 'number' &&
  row.rating >= POSITIVE_RATING &&
  typeof row.timestamp === 'number' &&
  Boolean(row.parent_asin?.trim()) &&
  Boolean(row.user_id?.trim())
);

const getUtcDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

const groupByDay = (interactions: PositiveInteraction[]) => {
  const byDay = new Map<string, Set<string>>();
  interactions.forEach((interaction) => {
    const day = getUtcDay(interaction.timestamp);
    const products = byDay.get(day) ?? new Set<string>();
    products.add(interaction.productId);
    byDay.set(day, products);
  });
  return byDay;
};

const inferRole = (text: string): OutfitRole => {
  if (/\b(jacket|coat|blazer|cardigan|hoodie|outerwear|windbreaker|parka)\b/.test(text)) return 'outerwear';
  if (/\b(dress|gown|romper|jumpsuit)\b/.test(text)) return 'dress';
  if (/\b(set|suit|tracksuit|outfit|two piece|2 piece|pajama)\b/.test(text)) return 'set';
  if (/\b(shoe|sneaker|boot|sandal|slipper|heel|loafer|footwear)\b/.test(text)) return 'shoes';
  if (/\b(pant|trouser|jean|short|skirt|legging|bottom)\b/.test(text)) return 'bottom';
  if (/\b(shirt|top|tee|t-shirt|blouse|sweater|sweatshirt|tank|polo|vest)\b/.test(text)) return 'top';
  return 'accessory';
};

const inferGender = (text: string): ProductFeature['gender'] => {
  const men = /\b(men|men's|male|boy|boys)\b/.test(text);
  const women = /\b(women|women's|female|girl|girls|ladies)\b/.test(text);
  if (men && women) return 'unisex';
  if (men) return 'men';
  if (women) return 'women';
  if (/\b(unisex)\b/.test(text)) return 'unisex';
  return null;
};

const getPriceBucket = (price?: number | null) => {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  if (price < 20) return 'under-20';
  if (price < 50) return '20-49';
  if (price < 100) return '50-99';
  return '100-plus';
};

const toProductFeature = (row: ProductMetadataRow): ProductFeature | null => {
  const productId = row.parent_asin?.trim();
  if (!productId) return null;
  const detailsText = Object.entries(row.details ?? {})
    .map(([key, value]) => `${key} ${value}`)
    .join(' ');
  const text = normalizeText([row.title, ...(row.categories ?? []), detailsText].join(' '));
  const role = inferRole(text);

  return {
    productId,
    categoryId: role,
    brandId: normalizeText(row.store) || null,
    role,
    gender: inferGender(text),
    colors: new Set(COLOR_WORDS.filter((color) => new RegExp(`\\b${color}\\b`).test(text))),
    priceBucket: getPriceBucket(row.price),
  };
};

const overlapScore = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((value) => right.has(value)).length;
  return intersection / Math.max(left.size, right.size);
};

const genderCompatibility = (source: ProductFeature, candidate: ProductFeature) => {
  if (!source.gender || !candidate.gender) return 0.7;
  if (source.gender === 'unisex' || candidate.gender === 'unisex') return 0.9;
  return source.gender === candidate.gender ? 1 : 0.25;
};

const contentSimilarity = (source: ProductFeature, candidate: ProductFeature) => (
  0.35 * Number(source.categoryId === candidate.categoryId) +
  0.15 * genderCompatibility(source, candidate) +
  0.10 * Number(Boolean(source.brandId) && source.brandId === candidate.brandId) +
  0.15 * overlapScore(source.colors, candidate.colors) +
  0.15 * Number(Boolean(source.priceBucket) && source.priceBucket === candidate.priceBucket)
);

const toBinaryContentVector = (feature: ProductFeature) => new Set([
  `category:${feature.categoryId}`,
  ...(feature.gender ? [`gender:${feature.gender}`] : []),
  ...(feature.brandId ? [`brand:${feature.brandId}`] : []),
  ...[...feature.colors].map((color) => `color:${color}`),
  ...(feature.priceBucket ? [`price:${feature.priceBucket}`] : []),
]);

const binaryCosineSimilarity = (source: ProductFeature, candidate: ProductFeature) => {
  const sourceVector = toBinaryContentVector(source);
  const candidateVector = toBinaryContentVector(candidate);
  if (!sourceVector.size || !candidateVector.size) return 0;
  const dotProduct = [...sourceVector].filter((value) => candidateVector.has(value)).length;
  return dotProduct / Math.sqrt(sourceVector.size * candidateVector.size);
};

const cartRoleScore = (sourceRoles: OutfitRole[], candidateRole: OutfitRole) => {
  const best = Math.max(...sourceRoles.map((sourceRole) => CART_ROLE_COMPATIBILITY[sourceRole][candidateRole]));
  return sourceRoles.includes(candidateRole) ? Math.min(best, 0.2) : best;
};

const cartStyleScore = (source: ProductFeature, candidate: ProductFeature) => (
  0.40 * genderCompatibility(source, candidate) +
  0.25 * overlapScore(source.colors, candidate.colors) +
  0.20 * Number(Boolean(source.priceBucket) && source.priceBucket === candidate.priceBucket) +
  0.15 * Number(Boolean(source.brandId) && source.brandId === candidate.brandId)
);

const buildPreferenceProfile = (features: ProductFeature[]) => {
  const scoreMap = (getValues: (feature: ProductFeature) => Array<string | null>) => {
    const scores = new Map<string, number>();
    features.forEach((feature) => getValues(feature).filter(Boolean).forEach((value) => {
      scores.set(value as string, (scores.get(value as string) ?? 0) + 1);
    }));
    return scores;
  };
  return {
    categories: scoreMap((feature) => [feature.categoryId]),
    brands: scoreMap((feature) => [feature.brandId]),
    genders: scoreMap((feature) => [feature.gender]),
    colors: scoreMap((feature) => [...feature.colors]),
    prices: scoreMap((feature) => [feature.priceBucket]),
  };
};

const ratio = (scores: Map<string, number>, key: string | null) => {
  if (!key) return 0;
  return (scores.get(key) ?? 0) / Math.max(1, ...scores.values());
};

const preferenceMatch = (
  profile: ReturnType<typeof buildPreferenceProfile>,
  candidate: ProductFeature,
) => {
  const colorScore = candidate.colors.size
    ? [...candidate.colors].reduce((sum, color) => sum + ratio(profile.colors, color), 0) / candidate.colors.size
    : 0;
  return (
    0.35 * ratio(profile.categories, candidate.categoryId) +
    0.20 * ratio(profile.brands, candidate.brandId) +
    0.15 * colorScore +
    0.15 * ratio(profile.genders, candidate.gender) +
    0.15 * ratio(profile.prices, candidate.priceBucket)
  );
};

const getPairKey = (sourceId: string, candidateId: string) => `${sourceId}\u0000${candidateId}`;

const scanReviewCounts = async (reviewsPath: string) => {
  const userCounts = new Map<string, number>();
  let maxTimestamp = 0;
  let positiveRows = 0;

  await forEachJsonLine<ReviewRow>(reviewsPath, (row) => {
    if (!isPositiveReview(row)) return;
    const userId = row.user_id as string;
    userCounts.set(userId, (userCounts.get(userId) ?? 0) + 1);
    maxTimestamp = Math.max(maxTimestamp, row.timestamp as number);
    positiveRows += 1;
  });

  return { userCounts, maxTimestamp, positiveRows };
};

const collectEligibleInteractions = async (
  reviewsPath: string,
  userCounts: Map<string, number>,
  cutoff: number,
) => {
  const eligibleUsers = new Set(
    [...userCounts.entries()]
      .filter(([, count]) => count >= MIN_USER_POSITIVE_INTERACTIONS)
      .map(([userId]) => userId),
  );
  userCounts.clear();

  const interactionsByUser = new Map<string, PositiveInteraction[]>();
  const trainingPopularity = new Map<string, number>();

  await forEachJsonLine<ReviewRow>(reviewsPath, (row) => {
    if (!isPositiveReview(row)) return;
    const productId = row.parent_asin as string;
    const timestamp = row.timestamp as number;
    if (timestamp < cutoff) {
      trainingPopularity.set(productId, (trainingPopularity.get(productId) ?? 0) + 1);
    }
    if (!eligibleUsers.has(row.user_id as string)) return;
    const interactions = interactionsByUser.get(row.user_id as string) ?? [];
    interactions.push({ productId, timestamp });
    interactionsByUser.set(row.user_id as string, interactions);
  });

  interactionsByUser.forEach((interactions, userId) => {
    const latestByProduct = new Map<string, PositiveInteraction>();
    interactions.forEach((interaction) => {
      const current = latestByProduct.get(interaction.productId);
      if (!current || interaction.timestamp > current.timestamp) {
        latestByProduct.set(interaction.productId, interaction);
      }
    });
    interactionsByUser.set(userId, [...latestByProduct.values()].sort((a, b) => a.timestamp - b.timestamp));
  });

  return { interactionsByUser, trainingPopularity, eligibleUsers: eligibleUsers.size };
};

const buildDraftCases = (
  interactionsByUser: Map<string, PositiveInteraction[]>,
  testStart: number,
  testEnd: number,
  casesPerContext: number,
) => {
  const home: DraftCase[] = [];
  const similar: DraftCase[] = [];
  const cart: DraftCase[] = [];
  const users = deterministicOrder([...interactionsByUser.entries()], ([userId]) => userId);

  users.forEach(([userId, interactions]) => {
    const training = interactions.filter((interaction) => interaction.timestamp < testStart);
    const testing = interactions.filter((interaction) => (
      interaction.timestamp >= testStart && interaction.timestamp < testEnd
    ));
    if (training.length >= 4 && testing.length) {
      const relevantProductId = testing[0].productId;
      const historyProductIds = training.map((interaction) => interaction.productId);
      if (home.length < casesPerContext) {
        home.push({
          caseId: `HOME-${String(home.length + 1).padStart(4, '0')}`,
          context: 'home',
          historyProductIds,
          sourceProductIds: [],
          relevantProductId,
          excludedProductIds: new Set(historyProductIds),
        });
      }
      if (similar.length < casesPerContext) {
        similar.push({
          caseId: `SIMILAR-${String(similar.length + 1).padStart(4, '0')}`,
          context: 'product_detail_similar',
          historyProductIds: [],
          sourceProductIds: [training[training.length - 1].productId],
          relevantProductId,
          excludedProductIds: new Set([training[training.length - 1].productId]),
        });
      }
    }

    if (cart.length >= casesPerContext) return;
    const testingBaskets = [...groupByDay(testingOrEmpty(interactions, testStart, testEnd)).entries()]
      .filter(([, products]) => products.size >= 2)
      .sort(([left], [right]) => left.localeCompare(right));
    const lastBasket = testingBaskets[testingBaskets.length - 1];
    if (!lastBasket) return;
    const products = deterministicOrder([...lastBasket[1]], (productId) => `${userId}:${productId}`);
    cart.push({
      caseId: `CART-${String(cart.length + 1).padStart(4, '0')}`,
      context: 'cart',
      historyProductIds: [],
      sourceProductIds: products.slice(0, -1),
      relevantProductId: products[products.length - 1],
      excludedProductIds: new Set(products.slice(0, -1)),
    });
  });

  return { home, similar, cart };
};

const testingOrEmpty = (interactions: PositiveInteraction[], testStart: number, testEnd: number) => (
  interactions.filter((interaction) => (
    interaction.timestamp >= testStart && interaction.timestamp < testEnd
  ))
);

const loadRequiredMetadata = async (
  metadataPath: string,
  requiredProductIds: Set<string>,
) => {
  const featureByProductId = new Map<string, ProductFeature>();
  await forEachJsonLine<ProductMetadataRow>(metadataPath, (row) => {
    if (!row.parent_asin || !requiredProductIds.has(row.parent_asin)) return;
    const feature = toProductFeature(row);
    if (feature) featureByProductId.set(feature.productId, feature);
  });
  return featureByProductId;
};

const buildAssociationStatistics = (
  interactionsByUser: Map<string, PositiveInteraction[]>,
  cutoff: number,
  sourceIds: Set<string>,
  candidateIds: Set<string>,
) => {
  const sourceBasketCounts = new Map<string, number>();
  const candidateBasketCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  let basketCount = 0;

  interactionsByUser.forEach((interactions) => {
    groupByDay(interactions.filter((interaction) => interaction.timestamp < cutoff))
      .forEach((products) => {
        if (!products.size) return;
        basketCount += 1;
        const basketSources = [...products].filter((productId) => sourceIds.has(productId));
        const basketCandidates = [...products].filter((productId) => candidateIds.has(productId));
        basketSources.forEach((sourceId) => {
          sourceBasketCounts.set(sourceId, (sourceBasketCounts.get(sourceId) ?? 0) + 1);
          basketCandidates.forEach((candidateId) => {
            if (sourceId === candidateId) return;
            const key = getPairKey(sourceId, candidateId);
            pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
          });
        });
        basketCandidates.forEach((candidateId) => {
          candidateBasketCounts.set(candidateId, (candidateBasketCounts.get(candidateId) ?? 0) + 1);
        });
      });
  });

  const lift = (sourceId: string, candidateId: string) => {
    const pairCount = pairCounts.get(getPairKey(sourceId, candidateId)) ?? 0;
    const sourceCount = sourceBasketCounts.get(sourceId) ?? 0;
    const candidateCount = candidateBasketCounts.get(candidateId) ?? 0;
    if (!pairCount || !sourceCount || !candidateCount || !basketCount) return 0;
    return (pairCount * basketCount) / (sourceCount * candidateCount);
  };

  let maxLift = 0;
  sourceIds.forEach((sourceId) => candidateIds.forEach((candidateId) => {
    maxLift = Math.max(maxLift, lift(sourceId, candidateId));
  }));

  return {
    basketCount,
    normalizedLift: (sourceIdsForCase: string[], candidateId: string) => {
      const rawLift = Math.max(0, ...sourceIdsForCase.map((sourceId) => lift(sourceId, candidateId)));
      return maxLift > 0 ? Math.log1p(rawLift) / Math.log1p(maxLift) : 0;
    },
  };
};

const buildCandidatePool = (
  draft: DraftCase,
  catalogIds: string[],
  candidatesPerCase: number,
) => {
  const result: string[] = [draft.relevantProductId];
  const excluded = new Set([...draft.excludedProductIds, draft.relevantProductId]);
  const popularCount = Math.min(Math.floor(candidatesPerCase / 2), catalogIds.length);

  catalogIds.slice(0, popularCount).forEach((productId) => {
    if (!excluded.has(productId) && result.length < candidatesPerCase) result.push(productId);
  });
  deterministicOrder(catalogIds.slice(popularCount), (productId) => `${draft.caseId}:${productId}`)
    .forEach((productId) => {
      if (!excluded.has(productId) && result.length < candidatesPerCase) result.push(productId);
    });
  return result;
};

const run = async () => {
  const reviewsPath = path.resolve(getStringArg(
    'reviews',
    path.resolve(process.cwd(), '..', 'evaluation', 'recommendation', 'data', 'raw', 'Amazon_Fashion.jsonl'),
  ));
  const metadataPath = path.resolve(getStringArg(
    'metadata',
    path.resolve(process.cwd(), '..', 'evaluation', 'recommendation', 'data', 'raw', 'meta_Amazon_Fashion.jsonl'),
  ));
  const outputPath = path.resolve(getStringArg(
    'out',
    path.resolve(process.cwd(), '..', 'evaluation', 'recommendation', 'data', 'processed', 'amazon-fashion-cases.json'),
  ));
  const casesPerContext = getPositiveIntegerArg('cases', DEFAULT_CASES_PER_CONTEXT);
  const candidatesPerCase = getPositiveIntegerArg('candidates', DEFAULT_CANDIDATES_PER_CASE);
  const catalogSize = getPositiveIntegerArg('catalog', DEFAULT_CATALOG_SIZE);
  const testDays = getPositiveIntegerArg('test-days', DEFAULT_TEST_DAYS);
  const testFromArg = getStringArg('test-from', '');
  const testToArg = getStringArg('test-to', '');
  const context = getStringArg('context', 'all');
  if (
    context !== 'all' &&
    context !== 'home' &&
    context !== 'product_detail_similar' &&
    context !== 'cart'
  ) {
    throw new Error('context must be all, home, product_detail_similar, or cart');
  }

  console.error('Pass 1/3: scanning verified positive review counts...');
  const countStats = await scanReviewCounts(reviewsPath);
  const testStart = testFromArg
    ? parseDateArg('test-from', testFromArg)
    : countStats.maxTimestamp - testDays * DAY_MS;
  const testEnd = testToArg
    ? parseDateArg('test-to', testToArg)
    : countStats.maxTimestamp + 1;
  if (testStart >= testEnd) throw new Error('test-from must be earlier than test-to');
  console.error(`Training cutoff/test start: ${new Date(testStart).toISOString()}`);
  console.error(`Test end (exclusive): ${new Date(testEnd).toISOString()}`);

  console.error('Pass 2/3: collecting eligible user histories and training popularity...');
  const collected = await collectEligibleInteractions(reviewsPath, countStats.userCounts, testStart);
  const draftGroups = buildDraftCases(
    collected.interactionsByUser,
    testStart,
    testEnd,
    casesPerContext,
  );
  const drafts = context === 'home'
    ? draftGroups.home
    : context === 'product_detail_similar'
      ? draftGroups.similar
      : context === 'cart'
        ? draftGroups.cart
        : [...draftGroups.home, ...draftGroups.similar, ...draftGroups.cart];
  if (!drafts.length) throw new Error('No evaluation cases were created; adjust test-days or case limits');

  const popularityIds = [...collected.trainingPopularity.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, catalogSize)
    .map(([productId]) => productId);
  const requiredProductIds = new Set(popularityIds);
  drafts.forEach((draft) => {
    draft.historyProductIds.forEach((productId) => requiredProductIds.add(productId));
    draft.sourceProductIds.forEach((productId) => requiredProductIds.add(productId));
    requiredProductIds.add(draft.relevantProductId);
  });

  console.error('Pass 3/3: loading metadata for the candidate catalog and case anchors...');
  const featureByProductId = await loadRequiredMetadata(metadataPath, requiredProductIds);
  const catalogIds = popularityIds.filter((productId) => featureByProductId.has(productId));
  const maxPopularity = Math.max(1, ...catalogIds.map((productId) => collected.trainingPopularity.get(productId) ?? 0));
  const popularity = (productId: string) => (
    Math.log1p(collected.trainingPopularity.get(productId) ?? 0) / Math.log1p(maxPopularity)
  );

  const validDrafts = drafts.filter((draft) => (
    featureByProductId.has(draft.relevantProductId) &&
    draft.sourceProductIds.every((productId) => featureByProductId.has(productId)) &&
    draft.historyProductIds.some((productId) => featureByProductId.has(productId)) === (draft.context === 'home')
  ));
  const cartSourceIds = new Set(
    validDrafts.filter((draft) => draft.context === 'cart').flatMap((draft) => draft.sourceProductIds),
  );
  const associationCandidateIds = new Set(catalogIds);
  validDrafts
    .filter((draft) => draft.context === 'cart')
    .forEach((draft) => associationCandidateIds.add(draft.relevantProductId));
  const association = buildAssociationStatistics(
    collected.interactionsByUser,
    testStart,
    cartSourceIds,
    associationCandidateIds,
  );

  const cases = validDrafts.map<RecommendationBenchmarkCase | null>((draft) => {
    const candidateIds = buildCandidatePool(draft, catalogIds, candidatesPerCase)
      .filter((productId) => featureByProductId.has(productId));
    if (!candidateIds.includes(draft.relevantProductId)) return null;
    const sourceFeatures = draft.sourceProductIds
      .map((productId) => featureByProductId.get(productId))
      .filter((feature): feature is ProductFeature => Boolean(feature));
    const historyFeatures = draft.historyProductIds
      .map((productId) => featureByProductId.get(productId))
      .filter((feature): feature is ProductFeature => Boolean(feature));
    const profile = buildPreferenceProfile(historyFeatures);
    const sourceRoles = sourceFeatures.map((feature) => feature.role);

    const candidates = candidateIds.map<RecommendationBenchmarkCandidate>((productId) => {
      const feature = featureByProductId.get(productId) as ProductFeature;
      const base = {
        productId,
        categoryId: feature.categoryId,
        brandId: feature.brandId,
        signals: {
          popularity: popularity(productId),
          business: 0,
        },
      };

      if (draft.context === 'home') {
        return {
          ...base,
          signals: { ...base.signals, preferenceMatch: preferenceMatch(profile, feature) },
        };
      }
      if (draft.context === 'product_detail_similar') {
        return {
          ...base,
          signals: {
            ...base.signals,
            contentSimilarity: contentSimilarity(sourceFeatures[0], feature),
            cosineSimilarity: binaryCosineSimilarity(sourceFeatures[0], feature),
          },
        };
      }
      const bestStyle = Math.max(...sourceFeatures.map((source) => cartStyleScore(source, feature)));
      const bestGender = Math.max(...sourceFeatures.map((source) => genderCompatibility(source, feature)));
      return {
        ...base,
        signals: {
          ...base.signals,
          complementaryRole: cartRoleScore(sourceRoles, feature.role) * bestGender,
          styleCompatibility: bestStyle,
          associationLift: association.normalizedLift(draft.sourceProductIds, productId),
        },
      };
    });

    return {
      caseId: draft.caseId,
      context: draft.context,
      relevantProductIds: [draft.relevantProductId],
      candidates,
    };
  }).filter((benchmarkCase): benchmarkCase is RecommendationBenchmarkCase => Boolean(benchmarkCase));

  const dataset: RecommendationBenchmarkDataset & { preparation: Record<string, unknown> } = {
    schemaVersion: 1,
    dataset: {
      name: 'Amazon Reviews 2023 - Amazon Fashion controlled subset',
      source: 'McAuley-Lab/Amazon-Reviews-2023; Kaggle mirror pandeymritunjay/amazon-reco-ds v8',
      split: `train before ${new Date(testStart).toISOString()}; test from that timestamp to ${new Date(testEnd).toISOString()} (exclusive)`,
      notes: 'Verified purchases with rating >= 4. Product-detail relevance uses next-positive-item proxy; cart relevance uses held-out same-day co-review basket proxy. Business signal is fixed at zero because equivalent sale/new-arrival fields are unavailable.',
    },
    preparation: {
      positiveRows: countStats.positiveRows,
      eligibleUsers: collected.eligibleUsers,
      trainingCutoff: new Date(testStart).toISOString(),
      testFrom: new Date(testStart).toISOString(),
      testToExclusive: new Date(testEnd).toISOString(),
      minimumPositiveInteractionsPerUser: MIN_USER_POSITIVE_INTERACTIONS,
      requestedCasesPerContext: casesPerContext,
      generatedCasesByContext: Object.fromEntries(
        ['home', 'product_detail_similar', 'cart'].map((context) => [
          context,
          cases.filter((benchmarkCase) => benchmarkCase.context === context).length,
        ]),
      ),
      requestedCandidatesPerCase: candidatesPerCase,
      candidateCatalogSize: catalogIds.length,
      associationTrainingBaskets: association.basketCount,
      negativeSampling: 'Half most-popular candidates and half deterministic SHA-256 sample from the popularity-limited catalog; held-out relevant item forced into every case.',
    },
    cases,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(dataset)}\n`, 'utf8');
  console.error(`Wrote ${cases.length} cases to ${outputPath}`);
  console.log(JSON.stringify(dataset.preparation, null, 2));
};

run().catch((error) => {
  console.error('Amazon Fashion benchmark preparation failed:', error);
  process.exitCode = 1;
});
