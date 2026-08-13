export type CategoryAssociationModel = {
  basketCount: number;
  pairCount: number;
  hasEvidence: boolean;
  score: (sourceCategoryIds: string[], candidateCategoryId: string) => number;
};

const pairKey = (left: string, right: string) => (
  left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`
);

export const buildCategoryAssociationModel = (
  baskets: string[][],
  minimumPairCount = 1,
): CategoryAssociationModel => {
  const categoryCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const normalizedBaskets = baskets
    .map((basket) => [...new Set(basket.filter(Boolean))].sort())
    .filter((basket) => basket.length >= 2);

  normalizedBaskets.forEach((basket) => {
    basket.forEach((categoryId) => {
      categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
    });
    basket.forEach((left, index) => basket.slice(index + 1).forEach((right) => {
      const key = pairKey(left, right);
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }));
  });

  const rawLift = (left: string, right: string) => {
    if (!left || !right || left === right) return 0;
    const pairCount = pairCounts.get(pairKey(left, right)) ?? 0;
    const leftCount = categoryCounts.get(left) ?? 0;
    const rightCount = categoryCounts.get(right) ?? 0;
    if (pairCount < minimumPairCount || !leftCount || !rightCount) return 0;
    return (pairCount * normalizedBaskets.length) / (leftCount * rightCount);
  };
  const eligiblePairs = [...pairCounts.entries()].filter(([, count]) => count >= minimumPairCount);
  const maxLift = Math.max(0, ...eligiblePairs.map(([key]) => {
    const [left, right] = key.split('\u0000');
    return rawLift(left, right);
  }));

  return {
    basketCount: normalizedBaskets.length,
    pairCount: eligiblePairs.length,
    hasEvidence: maxLift > 0,
    score: (sourceCategoryIds, candidateCategoryId) => {
      if (maxLift <= 0) return 0;
      const lift = Math.max(
        0,
        ...sourceCategoryIds.map((sourceCategoryId) => rawLift(
          sourceCategoryId,
          candidateCategoryId,
        )),
      );
      return Math.log1p(lift) / Math.log1p(maxLift);
    },
  };
};
