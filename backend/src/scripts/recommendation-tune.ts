import fs from 'fs';
import path from 'path';
import {
  evaluateRecommendationBenchmarkMethod,
  type RecommendationBenchmarkContext,
  type RecommendationBenchmarkDataset,
  type RecommendationBenchmarkMetrics,
} from '../modules/recommendations/recommendation-benchmark';
import {
  RECOMMENDATION_SCORE_WEIGHTS,
  type RecommendationScoreWeights,
} from '../modules/recommendations/recommendation-scoring';

const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const getPositiveIntegerArg = (name: string, fallback: number) => {
  const value = Number(getStringArg(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

const roundWeight = (value: number) => Number(value.toFixed(3));

const range = (start: number, end: number, step: number) => {
  const values: number[] = [];
  for (let value = start; value <= end + 1e-9; value += step) {
    values.push(roundWeight(value));
  }
  return values;
};

const compareMetrics = (
  left: RecommendationBenchmarkMetrics,
  right: RecommendationBenchmarkMetrics,
) => {
  const keys: Array<keyof RecommendationBenchmarkMetrics> = [
    'ndcgAtK',
    'hitRateAtK',
    'mapAtK',
    'mrrAtK',
    'recallAtK',
    'precisionAtK',
    'catalogCoverageAtK',
  ];
  for (const key of keys) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
};

const buildProductDetailFoldAudit = (
  cases: RecommendationBenchmarkDataset['cases'],
  weights: RecommendationScoreWeights,
  k: number,
) => Array.from({ length: 5 }, (_, foldIndex) => {
  const foldCases = cases.filter((_, index) => index % 5 === foldIndex);
  const proposed = evaluateRecommendationBenchmarkMethod(
    foldCases,
    'proposed_hybrid',
    k,
    weights,
  );
  const baseline = evaluateRecommendationBenchmarkMethod(
    foldCases,
    'cosine_similarity',
    k,
    weights,
  );
  return {
    fold: foldIndex + 1,
    cases: foldCases.length,
    proposed: { hitRateAtK: proposed.hitRateAtK, ndcgAtK: proposed.ndcgAtK },
    cosine: { hitRateAtK: baseline.hitRateAtK, ndcgAtK: baseline.ndcgAtK },
    delta: {
      hitRateAtK: Number((proposed.hitRateAtK - baseline.hitRateAtK).toFixed(6)),
      ndcgAtK: Number((proposed.ndcgAtK - baseline.ndcgAtK).toFixed(6)),
    },
  };
});

const generateWeightCandidates = (): RecommendationScoreWeights[] => {
  const candidates: RecommendationScoreWeights[] = [];

  range(0.40, 0.90, 0.05).forEach((preferenceMatch) => {
    candidates.push({
      ...RECOMMENDATION_SCORE_WEIGHTS,
      home: {
        preferenceMatch,
        popularity: roundWeight(0.90 - preferenceMatch),
        business: 0.10,
      },
    });
  });

  // Product Detail stage 1: exhaustive coarse simplex search.
  range(0, 1, 0.05).forEach((contentSimilarity) => {
    range(0, 1 - contentSimilarity, 0.05).forEach((popularity) => {
      candidates.push({
        ...RECOMMENDATION_SCORE_WEIGHTS,
        productDetailSimilar: {
          contentSimilarity,
          cosineSimilarity: roundWeight(1 - contentSimilarity - popularity),
          popularity,
          business: 0,
        },
      });
    });
  });

  // Product Detail stage 2: fine search around the best coarse region.
  range(0, 0.20, 0.005).forEach((contentSimilarity) => {
    range(0, 0.05, 0.005).forEach((popularity) => {
      candidates.push({
        ...RECOMMENDATION_SCORE_WEIGHTS,
        productDetailSimilar: {
          contentSimilarity,
          cosineSimilarity: roundWeight(1 - contentSimilarity - popularity),
          popularity,
          business: 0,
        },
      });
    });
  });

  range(0.40, 0.85, 0.05).forEach((complementaryRole) => {
    range(0.05, 0.30, 0.05).forEach((styleCompatibility) => {
      const popularity = roundWeight(0.95 - complementaryRole - styleCompatibility);
      if (popularity < 0 || popularity > 0.50) return;
      candidates.push({
        ...RECOMMENDATION_SCORE_WEIGHTS,
        cart: {
          complementaryRole,
          styleCompatibility,
          popularity,
          business: 0.05,
        },
      });
    });
  });

  range(0.20, 0.70, 0.05).forEach((complementaryRole) => {
    range(0.05, 0.30, 0.05).forEach((styleCompatibility) => {
      const associationLift = roundWeight(0.95 - complementaryRole - styleCompatibility);
      if (associationLift < 0.05 || associationLift > 0.70) return;
      candidates.push({
        ...RECOMMENDATION_SCORE_WEIGHTS,
        cart: {
          complementaryRole,
          styleCompatibility,
          popularity: 0,
          business: 0.05,
          associationLift,
        },
      });
    });
  });

  return candidates;
};

const tuneContext = (
  dataset: RecommendationBenchmarkDataset,
  context: RecommendationBenchmarkContext,
  candidates: RecommendationScoreWeights[],
  k: number,
) => {
  const cases = dataset.cases.filter((benchmarkCase) => benchmarkCase.context === context);
  if (!cases.length) throw new Error(`Validation dataset has no ${context} cases`);

  let bestWeights = RECOMMENDATION_SCORE_WEIGHTS;
  let bestMetrics = evaluateRecommendationBenchmarkMethod(
    cases,
    'proposed_hybrid',
    k,
    bestWeights,
  );
  let searched = 0;

  candidates.forEach((weights) => {
    const differsInContext = JSON.stringify(weights[context === 'home'
      ? 'home'
      : context === 'product_detail_similar'
        ? 'productDetailSimilar'
        : 'cart']) !== JSON.stringify(RECOMMENDATION_SCORE_WEIGHTS[context === 'home'
      ? 'home'
      : context === 'product_detail_similar'
        ? 'productDetailSimilar'
        : 'cart']);
    if (!differsInContext) return;

    searched += 1;
    const metrics = evaluateRecommendationBenchmarkMethod(cases, 'proposed_hybrid', k, weights);
    if (compareMetrics(metrics, bestMetrics) > 0) {
      bestMetrics = metrics;
      bestWeights = weights;
    }
  });

  if (context === 'product_detail_similar') {
    const baselineMetrics = evaluateRecommendationBenchmarkMethod(
      cases,
      'cosine_similarity',
      k,
      bestWeights,
    );
    if (compareMetrics(baselineMetrics, bestMetrics) > 0) {
      const guardedWeights: RecommendationScoreWeights = {
        ...bestWeights,
        productDetailSimilar: {
          contentSimilarity: 0,
          cosineSimilarity: 1,
          popularity: 0,
          business: 0,
        },
      };
      return {
        searchedConfigurations: searched + 1,
        metrics: baselineMetrics,
        weights: guardedWeights,
        guardrail: 'Selected exact cosine because every searched hybrid scored lower on validation.',
        foldAudit: buildProductDetailFoldAudit(cases, guardedWeights, k),
      };
    }
  }

  return {
    searchedConfigurations: searched + 1,
    metrics: bestMetrics,
    weights: bestWeights,
    ...(context === 'product_detail_similar'
      ? { foldAudit: buildProductDetailFoldAudit(cases, bestWeights, k) }
      : {}),
  };
};

const run = () => {
  const defaultInput = path.resolve(
    process.cwd(),
    '..',
    'evaluation',
    'recommendation',
    'data',
    'processed',
    'amazon-fashion-validation.json',
  );
  const defaultOutput = path.resolve(
    process.cwd(),
    '..',
    'evaluation',
    'recommendation',
    'configs',
    'v5-validation-tuned.json',
  );
  const inputPath = path.resolve(getStringArg('input', defaultInput));
  const outputPath = path.resolve(getStringArg('out', defaultOutput));
  const k = getPositiveIntegerArg('k', 5);
  const context = getStringArg('context', 'all');
  if (
    context !== 'all' &&
    context !== 'home' &&
    context !== 'product_detail_similar' &&
    context !== 'cart'
  ) {
    throw new Error('context must be all, home, product_detail_similar, or cart');
  }
  const dataset = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as RecommendationBenchmarkDataset;
  const candidates = generateWeightCandidates();
  const cart = context === 'all' || context === 'cart'
    ? tuneContext(dataset, 'cart', candidates, k)
    : null;
  const home = context === 'all' || context === 'home'
    ? tuneContext(dataset, 'home', candidates, k)
    : null;
  const productDetailSimilar = context === 'all' || context === 'product_detail_similar'
    ? tuneContext(dataset, 'product_detail_similar', candidates, k)
    : null;
  const weights: RecommendationScoreWeights = {
    home: home?.weights.home ?? RECOMMENDATION_SCORE_WEIGHTS.home,
    productDetailSimilar: productDetailSimilar?.weights.productDetailSimilar ??
      RECOMMENDATION_SCORE_WEIGHTS.productDetailSimilar,
    cart: cart?.weights.cart ?? RECOMMENDATION_SCORE_WEIGHTS.cart,
  };
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    selectionDataset: dataset.dataset,
    objective: 'Maximize NDCG@5; deterministic tie-breaks: HR, MAP, MRR, Recall, Precision, Coverage',
    constraints: {
      step: 0.05,
      productDetailSearch: {
        coarse: 'Full content/cosine/popularity simplex at step 0.05',
        fine: 'content [0, 0.20] and popularity [0, 0.05] at step 0.005; cosine is the remainder',
        folds: 5,
      },
      businessWeightsFixed: { home: 0.10, productDetailSimilar: 0, cart: 0.05 },
      note: 'The public datasets lack equivalent business signals, so Product Detail business is excluded. Exact cosine is the guardrail when every searched hybrid is worse on validation.',
    },
    k,
    weights,
    validation: {
      ...(home ? { home } : {}),
      ...(productDetailSimilar ? { productDetailSimilar } : {}),
      ...(cart ? { cart: {
        ...cart,
        warning: dataset.dataset.name.toLowerCase().includes('polyvore')
          ? 'Polyvore provides outfit-completion labels, but unavailable production attributes are represented only by the documented metadata proxy.'
          : 'Cart relevance is a same-day co-review proxy and must be confirmed by a controlled user study.',
      } } : {}),
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  console.error(`Tuned weights written to ${outputPath}`);
};

try {
  run();
} catch (error) {
  console.error('Recommendation tuning failed:', error);
  process.exitCode = 1;
}
