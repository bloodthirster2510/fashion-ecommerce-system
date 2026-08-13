import {
  rankRecommendationBenchmarkCase,
  runRecommendationBenchmark,
  type RecommendationBenchmarkCase,
  type RecommendationBenchmarkDataset,
} from '../recommendation-benchmark';

const candidate = (
  productId: string,
  signals: RecommendationBenchmarkCase['candidates'][number]['signals'],
) => ({
  productId,
  categoryId: `category-${productId}`,
  brandId: `brand-${productId}`,
  signals,
});

const dataset: RecommendationBenchmarkDataset = {
  schemaVersion: 1,
  dataset: {
    name: 'unit-test',
    source: 'inline fixture',
    split: 'fixed',
  },
  cases: [
    {
      caseId: 'home-1',
      context: 'home',
      relevantProductIds: ['personal-match'],
      candidates: [
        candidate('personal-match', {
          preferenceMatch: 1,
          popularity: 0.2,
          business: 0,
        }),
        candidate('globally-popular', {
          preferenceMatch: 0,
          popularity: 1,
          business: 0,
        }),
      ],
    },
    {
      caseId: 'similar-1',
      context: 'product_detail_similar',
      relevantProductIds: ['balanced-match'],
      candidates: [
        candidate('balanced-match', {
          contentSimilarity: 0.9,
          cosineSimilarity: 1,
          popularity: 1,
          business: 1,
        }),
        candidate('content-only-match', {
          contentSimilarity: 1,
          cosineSimilarity: 0.2,
          popularity: 0,
          business: 0,
        }),
      ],
    },
    {
      caseId: 'cart-1',
      context: 'cart',
      relevantProductIds: ['outfit-match'],
      candidates: [
        candidate('outfit-match', {
          complementaryRole: 1,
          styleCompatibility: 1,
          popularity: 0.2,
          business: 0,
          associationLift: 0.2,
        }),
        candidate('frequent-pair', {
          complementaryRole: 0.1,
          styleCompatibility: 0,
          popularity: 1,
          business: 0,
          associationLift: 0.9,
        }),
      ],
    },
  ],
};

describe('recommendation benchmark', () => {
  it('compares the proposed formula with the context-specific baseline', () => {
    const result = runRecommendationBenchmark(dataset, 1);

    expect(result.contexts).toHaveLength(3);
    expect(result.contexts.find(({ context }) => context === 'home')?.delta.hitRateAtK).toBe(1);
    expect(result.contexts.find(({ context }) => context === 'cart')?.delta.hitRateAtK).toBe(1);
    const similar = result.contexts.find(({ context }) => context === 'product_detail_similar');
    expect(similar?.proposed.hitRateAtK).toBe(1);
    expect(similar?.baseline.hitRateAtK).toBe(1);
    expect(similar?.delta.hitRateAtK).toBe(0);
  });

  it('uses deterministic product IDs to break equal-score ties', () => {
    const benchmarkCase: RecommendationBenchmarkCase = {
      caseId: 'tie',
      context: 'home',
      relevantProductIds: ['a'],
      candidates: [
        candidate('b', { preferenceMatch: 0, popularity: 1, business: 0 }),
        candidate('a', { preferenceMatch: 0, popularity: 1, business: 0 }),
      ],
    };

    expect(rankRecommendationBenchmarkCase(benchmarkCase, 'most_popular', 2)
      .map((item) => item.productId)).toEqual(['a', 'b']);
  });

  it('fails instead of silently replacing a missing cart baseline signal', () => {
    const invalidCase: RecommendationBenchmarkCase = {
      caseId: 'missing-lift',
      context: 'cart',
      relevantProductIds: ['a'],
      candidates: [
        candidate('a', {
          complementaryRole: 1,
          styleCompatibility: 1,
          popularity: 1,
          business: 0,
        }),
      ],
    };

    expect(() => rankRecommendationBenchmarkCase(invalidCase, 'association_lift', 1))
      .toThrow('associationLift is required');
  });
});
