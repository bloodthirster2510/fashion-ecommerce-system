import {
  applyRecommendationDiversity,
  calculateCartRecommendationScore,
  calculatePersonalRecommendationScore,
  calculateSimilarRecommendationScore,
  RECOMMENDATION_SCORE_WEIGHTS,
  type RecommendationScoreWeights,
} from './recommendation-scoring';
import { RECOMMENDATION_ALGORITHM_VERSION } from './recommendation.types';

export type RecommendationBenchmarkContext = 'home' | 'product_detail_similar' | 'cart';
export type RecommendationBenchmarkMethod =
  | 'proposed_hybrid'
  | 'most_popular'
  | 'cosine_similarity'
  | 'association_lift';

export type RecommendationBenchmarkSignals = {
  preferenceMatch?: number;
  contentSimilarity?: number;
  complementaryRole?: number;
  styleCompatibility?: number;
  popularity: number;
  business: number;
  associationLift?: number;
  cosineSimilarity?: number;
};

export type RecommendationBenchmarkCandidate = {
  productId: string;
  categoryId?: string | null;
  brandId?: string | null;
  signals: RecommendationBenchmarkSignals;
};

export type RecommendationBenchmarkCase = {
  caseId: string;
  context: RecommendationBenchmarkContext;
  relevantProductIds: string[];
  candidates: RecommendationBenchmarkCandidate[];
};

export type RecommendationBenchmarkDataset = {
  schemaVersion: 1;
  dataset: {
    name: string;
    source: string;
    split: string;
    notes?: string;
  };
  cases: RecommendationBenchmarkCase[];
};

export type RecommendationBenchmarkMetrics = {
  cases: number;
  hitRateAtK: number;
  precisionAtK: number;
  recallAtK: number;
  mapAtK: number;
  mrrAtK: number;
  ndcgAtK: number;
  catalogCoverageAtK: number;
  categoryDiversityAtK: number;
  brandDiversityAtK: number;
};

type RankedCandidate = RecommendationBenchmarkCandidate & {
  score: number;
  productItem: {
    _id: string;
    category?: { _id: string } | null;
    brand?: { _id: string } | null;
  };
};

const BASELINE_BY_CONTEXT: Record<RecommendationBenchmarkContext, RecommendationBenchmarkMethod> = {
  home: 'most_popular',
  product_detail_similar: 'cosine_similarity',
  cart: 'association_lift',
};

const roundMetric = (value: number) => Number(value.toFixed(6));

const requireFiniteSignal = (
  benchmarkCase: RecommendationBenchmarkCase,
  candidate: RecommendationBenchmarkCandidate,
  name: keyof RecommendationBenchmarkSignals,
) => {
  const value = candidate.signals[name];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Case ${benchmarkCase.caseId}, product ${candidate.productId}: ${name} is required`,
    );
  }

  if (value < 0 || value > 1) {
    throw new Error(
      `Case ${benchmarkCase.caseId}, product ${candidate.productId}: ${name} must be normalized to [0, 1]`,
    );
  }

  return value;
};

const getCandidateScore = (
  benchmarkCase: RecommendationBenchmarkCase,
  candidate: RecommendationBenchmarkCandidate,
  method: RecommendationBenchmarkMethod,
  weights: RecommendationScoreWeights,
) => {
  if (method === 'most_popular') {
    return requireFiniteSignal(benchmarkCase, candidate, 'popularity');
  }

  if (method === 'cosine_similarity') {
    return requireFiniteSignal(benchmarkCase, candidate, 'cosineSimilarity');
  }

  if (method === 'association_lift') {
    return requireFiniteSignal(benchmarkCase, candidate, 'associationLift');
  }

  if (benchmarkCase.context === 'home') {
    return calculatePersonalRecommendationScore({
      preferenceMatch: requireFiniteSignal(benchmarkCase, candidate, 'preferenceMatch'),
      popularity: requireFiniteSignal(benchmarkCase, candidate, 'popularity'),
      business: requireFiniteSignal(benchmarkCase, candidate, 'business'),
    }, weights.home);
  }

  if (benchmarkCase.context === 'product_detail_similar') {
    return calculateSimilarRecommendationScore({
      contentSimilarity: requireFiniteSignal(benchmarkCase, candidate, 'contentSimilarity'),
      cosineSimilarity: (weights.productDetailSimilar.cosineSimilarity ?? 0) > 0
        ? requireFiniteSignal(benchmarkCase, candidate, 'cosineSimilarity')
        : 0,
      popularity: requireFiniteSignal(benchmarkCase, candidate, 'popularity'),
      business: requireFiniteSignal(benchmarkCase, candidate, 'business'),
    }, weights.productDetailSimilar);
  }

  return calculateCartRecommendationScore({
    complementaryRole: requireFiniteSignal(benchmarkCase, candidate, 'complementaryRole'),
    styleCompatibility: requireFiniteSignal(benchmarkCase, candidate, 'styleCompatibility'),
    popularity: requireFiniteSignal(benchmarkCase, candidate, 'popularity'),
    business: requireFiniteSignal(benchmarkCase, candidate, 'business'),
    associationLift: (weights.cart.associationLift ?? 0) > 0
      ? requireFiniteSignal(benchmarkCase, candidate, 'associationLift')
      : 0,
  }, weights.cart);
};

export const rankRecommendationBenchmarkCase = (
  benchmarkCase: RecommendationBenchmarkCase,
  method: RecommendationBenchmarkMethod,
  k: number,
  weights: RecommendationScoreWeights = RECOMMENDATION_SCORE_WEIGHTS,
) => {
  if (!Number.isInteger(k) || k < 1) {
    throw new Error('k must be a positive integer');
  }

  const ranked = benchmarkCase.candidates
    .map<RankedCandidate>((candidate) => ({
      ...candidate,
      score: getCandidateScore(benchmarkCase, candidate, method, weights),
      productItem: {
        _id: candidate.productId,
        category: candidate.categoryId ? { _id: candidate.categoryId } : null,
        brand: candidate.brandId ? { _id: candidate.brandId } : null,
      },
    }))
    .sort((left, right) => right.score - left.score || left.productId.localeCompare(right.productId));

  return applyRecommendationDiversity(ranked, k).map((candidate) => ({
    productId: candidate.productId,
    score: roundMetric(candidate.score),
    categoryId: candidate.categoryId ?? null,
    brandId: candidate.brandId ?? null,
  }));
};

const validateBenchmarkCase = (benchmarkCase: RecommendationBenchmarkCase) => {
  if (!benchmarkCase.caseId.trim()) throw new Error('Every benchmark case requires caseId');
  if (!BASELINE_BY_CONTEXT[benchmarkCase.context]) {
    throw new Error(`Case ${benchmarkCase.caseId}: unsupported context ${benchmarkCase.context}`);
  }
  if (!benchmarkCase.relevantProductIds.length) {
    throw new Error(`Case ${benchmarkCase.caseId}: relevantProductIds cannot be empty`);
  }
  if (!benchmarkCase.candidates.length) {
    throw new Error(`Case ${benchmarkCase.caseId}: candidates cannot be empty`);
  }

  const candidateIds = new Set<string>();
  benchmarkCase.candidates.forEach((candidate) => {
    if (!candidate.productId.trim()) {
      throw new Error(`Case ${benchmarkCase.caseId}: every candidate requires productId`);
    }
    if (candidateIds.has(candidate.productId)) {
      throw new Error(`Case ${benchmarkCase.caseId}: duplicate candidate ${candidate.productId}`);
    }
    candidateIds.add(candidate.productId);
  });
};

export const evaluateRecommendationBenchmarkMethod = (
  cases: RecommendationBenchmarkCase[],
  method: RecommendationBenchmarkMethod,
  k: number,
  weights: RecommendationScoreWeights = RECOMMENDATION_SCORE_WEIGHTS,
): RecommendationBenchmarkMetrics => {
  let hits = 0;
  let precisionSum = 0;
  let recallSum = 0;
  let averagePrecisionSum = 0;
  let reciprocalRankSum = 0;
  let ndcgSum = 0;
  let categoryDiversitySum = 0;
  let brandDiversitySum = 0;
  const uniqueRecommendedIds = new Set<string>();
  const candidateCatalogIds = new Set<string>();

  cases.forEach((benchmarkCase) => {
    validateBenchmarkCase(benchmarkCase);
    benchmarkCase.candidates.forEach((candidate) => candidateCatalogIds.add(candidate.productId));

    const relevantIds = new Set(benchmarkCase.relevantProductIds);
    const ranked = rankRecommendationBenchmarkCase(benchmarkCase, method, k, weights);
    let hitCount = 0;
    let averagePrecision = 0;
    let dcg = 0;
    let firstRelevantRank = 0;

    ranked.forEach((candidate, index) => {
      uniqueRecommendedIds.add(candidate.productId);
      if (!relevantIds.has(candidate.productId)) return;

      hitCount += 1;
      averagePrecision += hitCount / (index + 1);
      dcg += 1 / Math.log2(index + 2);
      if (!firstRelevantRank) firstRelevantRank = index + 1;
    });

    const idealHitCount = Math.min(relevantIds.size, k);
    const idealDcg = Array.from(
      { length: idealHitCount },
      (_, index) => 1 / Math.log2(index + 2),
    ).reduce((sum, value) => sum + value, 0);
    const categoryCount = new Set(ranked.map((candidate) => candidate.categoryId).filter(Boolean)).size;
    const brandCount = new Set(ranked.map((candidate) => candidate.brandId).filter(Boolean)).size;

    hits += hitCount > 0 ? 1 : 0;
    precisionSum += hitCount / k;
    recallSum += hitCount / relevantIds.size;
    averagePrecisionSum += idealHitCount ? averagePrecision / idealHitCount : 0;
    reciprocalRankSum += firstRelevantRank ? 1 / firstRelevantRank : 0;
    ndcgSum += idealDcg ? dcg / idealDcg : 0;
    categoryDiversitySum += ranked.length ? categoryCount / ranked.length : 0;
    brandDiversitySum += ranked.length ? brandCount / ranked.length : 0;
  });

  const count = cases.length;
  return {
    cases: count,
    hitRateAtK: count ? roundMetric(hits / count) : 0,
    precisionAtK: count ? roundMetric(precisionSum / count) : 0,
    recallAtK: count ? roundMetric(recallSum / count) : 0,
    mapAtK: count ? roundMetric(averagePrecisionSum / count) : 0,
    mrrAtK: count ? roundMetric(reciprocalRankSum / count) : 0,
    ndcgAtK: count ? roundMetric(ndcgSum / count) : 0,
    catalogCoverageAtK: candidateCatalogIds.size
      ? roundMetric(uniqueRecommendedIds.size / candidateCatalogIds.size)
      : 0,
    categoryDiversityAtK: count ? roundMetric(categoryDiversitySum / count) : 0,
    brandDiversityAtK: count ? roundMetric(brandDiversitySum / count) : 0,
  };
};

const metricDelta = (
  proposed: RecommendationBenchmarkMetrics,
  baseline: RecommendationBenchmarkMetrics,
) => Object.fromEntries(
  (Object.keys(proposed) as Array<keyof RecommendationBenchmarkMetrics>)
    .filter((key) => key !== 'cases')
    .map((key) => [key, roundMetric(proposed[key] - baseline[key])]),
);

export const runRecommendationBenchmark = (
  dataset: RecommendationBenchmarkDataset,
  k: number,
  weights: RecommendationScoreWeights = RECOMMENDATION_SCORE_WEIGHTS,
  algorithmVersion = RECOMMENDATION_ALGORITHM_VERSION,
) => {
  if (dataset.schemaVersion !== 1) throw new Error('Unsupported benchmark schemaVersion');
  if (!dataset.cases.length) throw new Error('Benchmark dataset has no cases');

  const contexts = (Object.keys(BASELINE_BY_CONTEXT) as RecommendationBenchmarkContext[])
    .flatMap((context) => {
      const cases = dataset.cases.filter((benchmarkCase) => benchmarkCase.context === context);
      if (!cases.length) return [];

      const baselineMethod = BASELINE_BY_CONTEXT[context];
      const proposed = evaluateRecommendationBenchmarkMethod(cases, 'proposed_hybrid', k, weights);
      const baseline = evaluateRecommendationBenchmarkMethod(cases, baselineMethod, k, weights);

      return [{
        context,
        baselineMethod,
        proposed,
        baseline,
        delta: metricDelta(proposed, baseline),
      }];
    });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    algorithmVersion,
    weights,
    k,
    dataset: dataset.dataset,
    contexts,
  };
};
