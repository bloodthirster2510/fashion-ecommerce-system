export type RecommendationScoreWeights = {
  home: {
    preferenceMatch: number;
    popularity: number;
    business: number;
  };
  productDetailSimilar: {
    contentSimilarity: number;
    cosineSimilarity?: number;
    popularity: number;
    business: number;
  };
  cart: {
    complementaryRole: number;
    styleCompatibility: number;
    popularity: number;
    business: number;
    associationLift?: number;
  };
};

export const RECOMMENDATION_SCORE_WEIGHTS: RecommendationScoreWeights = {
  home: {
    preferenceMatch: 0.90,
    popularity: 0,
    business: 0.10,
  },
  productDetailSimilar: {
    contentSimilarity: 0.125,
    cosineSimilarity: 0.875,
    popularity: 0,
    business: 0,
  },
  cart: {
    complementaryRole: 0.20,
    styleCompatibility: 0.25,
    popularity: 0,
    business: 0.05,
    associationLift: 0.50,
  },
};

export const CART_RULE_ONLY_FALLBACK_WEIGHTS: RecommendationScoreWeights['cart'] = {
  complementaryRole: 0.65,
  styleCompatibility: 0.30,
  popularity: 0,
  business: 0.05,
  associationLift: 0,
};

const DIVERSITY_PENALTIES = {
  repeatedCategory: 0.08,
  repeatedBrand: 0.04,
};

export const calculatePersonalRecommendationScore = ({
  preferenceMatch,
  popularity,
  business,
}: {
  preferenceMatch: number;
  popularity: number;
  business: number;
}, weights = RECOMMENDATION_SCORE_WEIGHTS.home) => (
  weights.preferenceMatch * preferenceMatch +
  weights.popularity * popularity +
  weights.business * business
);

export const calculateSimilarRecommendationScore = ({
  contentSimilarity,
  cosineSimilarity = 0,
  popularity,
  business,
}: {
  contentSimilarity: number;
  cosineSimilarity?: number;
  popularity: number;
  business: number;
}, weights = RECOMMENDATION_SCORE_WEIGHTS.productDetailSimilar) => (
  weights.contentSimilarity * contentSimilarity +
  (weights.cosineSimilarity ?? 0) * cosineSimilarity +
  weights.popularity * popularity +
  weights.business * business
);

export const calculateCartRecommendationScore = ({
  complementaryRole,
  styleCompatibility,
  popularity,
  business,
  associationLift = 0,
}: {
  complementaryRole: number;
  styleCompatibility: number;
  popularity: number;
  business: number;
  associationLift?: number;
}, weights = RECOMMENDATION_SCORE_WEIGHTS.cart) => (
  weights.complementaryRole * complementaryRole +
  weights.styleCompatibility * styleCompatibility +
  weights.popularity * popularity +
  weights.business * business +
  (weights.associationLift ?? 0) * associationLift
);

export type DiversityCandidate = {
  score: number;
  productItem: {
    _id: string;
    category?: { _id: string } | null;
    brand?: { _id: string } | null;
  };
};

export const applyRecommendationDiversity = <T extends DiversityCandidate>(items: T[], limit: number) => {
  const remaining = [...items];
  const categoryCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const selected: T[] = [];

  while (remaining.length && selected.length < limit) {
    let bestIndex = 0;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;

    remaining.forEach((item, index) => {
      const categoryId = item.productItem.category?._id ?? `unknown:${item.productItem._id}`;
      const brandId = item.productItem.brand?._id ?? `unknown:${item.productItem._id}`;
      const adjustedScore =
        item.score -
        DIVERSITY_PENALTIES.repeatedCategory * (categoryCounts.get(categoryId) ?? 0) -
        DIVERSITY_PENALTIES.repeatedBrand * (brandCounts.get(brandId) ?? 0);

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = index;
      }
    });

    const [nextItem] = remaining.splice(bestIndex, 1);
    const categoryId = nextItem.productItem.category?._id ?? `unknown:${nextItem.productItem._id}`;
    const brandId = nextItem.productItem.brand?._id ?? `unknown:${nextItem.productItem._id}`;

    selected.push(nextItem);
    categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
    brandCounts.set(brandId, (brandCounts.get(brandId) ?? 0) + 1);
  }

  return selected;
};
