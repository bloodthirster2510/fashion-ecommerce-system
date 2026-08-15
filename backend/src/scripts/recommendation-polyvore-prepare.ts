import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  RecommendationBenchmarkCandidate,
  RecommendationBenchmarkCase,
  RecommendationBenchmarkDataset,
} from '../modules/recommendations/recommendation-benchmark';

type OutfitRole = 'top' | 'bottom' | 'dress' | 'set' | 'shoes' | 'accessory' | 'outerwear';

type PolyvoreItem = {
  index: number;
  name: string;
  price: number;
  likes: number;
  categoryid: number;
};

type PolyvoreOutfit = {
  set_id: string;
  name: string;
  desc: string;
  items: PolyvoreItem[];
};

type FillInBlankQuestion = {
  question: string[];
  answers: string[];
  blank_position: number;
};

type ProductFeature = {
  productId: string;
  categoryId: string;
  role: OutfitRole;
  colors: Set<string>;
  price: number;
  likes: number;
};

type CaseDraft = {
  caseId: string;
  sourceIds: string[];
  relevantId: string;
  officialNegativeIds: string[];
};

const DEFAULT_CANDIDATES = 200;
const DEFAULT_VALIDATION_CASES = 1000;

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
  'burgundy', 'maroon', 'teal', 'turquoise', 'coral', 'ivory', 'tan', 'camel',
];
const COLOR_PATTERNS = COLOR_WORDS.map((color) => [color, new RegExp(`\\b${color}\\b`)] as const);

const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
};

const getPositiveIntegerArg = (name: string, fallback: number) => {
  const value = Number(getStringArg(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

const hashValue = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const deterministicOrder = <T>(values: T[], getKey: (value: T) => string) => (
  [...values].sort((left, right) => hashValue(getKey(left)).localeCompare(hashValue(getKey(right))))
);

const readJson = <T>(filePath: string) => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const parseCategoryNames = (filePath: string) => new Map(
  fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(' ');
      return [Number(line.slice(0, separator)), line.slice(separator + 1).trim()] as const;
    }),
);

const inferRole = (text: string): OutfitRole | null => {
  if (/\b(jacket|coat|blazer|cardigan|hoodie|outerwear|windbreaker|parka|cape|vest)\b/.test(text)) return 'outerwear';
  if (/\b(dress|gown|romper|jumpsuit)\b/.test(text)) return 'dress';
  if (/\b(set|suit|tracksuit|outfit|two piece|2 piece|pajama)\b/.test(text)) return 'set';
  if (/\b(shoe|sneaker|boot|sandal|slipper|heel|loafer|pump|flat|footwear)\b/.test(text)) return 'shoes';
  if (/\b(pant|trouser|jean|short|skirt|legging|bottom)\b/.test(text)) return 'bottom';
  if (/\b(shirt|top|tee|t-shirt|blouse|sweater|sweatshirt|tank|polo|tunic)\b/.test(text)) return 'top';
  if (/\b(bag|clutch|wallet|belt|glove|hat|tie|sunglass|jewelry|watch|necklace|earring|bracelet|ring|scarf|accessor)\b/.test(text)) return 'accessory';
  return null;
};

const toProductId = (setId: string, index: number) => `${setId}_${index}`;

const toFeature = (
  outfit: PolyvoreOutfit,
  item: PolyvoreItem,
  categoryNames: Map<number, string>,
): ProductFeature | null => {
  const categoryName = categoryNames.get(item.categoryid) ?? '';
  const text = `${categoryName} ${item.name}`.trim().toLowerCase();
  const role = inferRole(text);
  if (!role) return null;
  return {
    productId: toProductId(outfit.set_id, item.index),
    categoryId: String(item.categoryid),
    role,
    colors: new Set(COLOR_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([color]) => color)),
    price: Number.isFinite(item.price) && item.price > 0 ? item.price : 0,
    likes: Number.isFinite(item.likes) && item.likes > 0 ? item.likes : 0,
  };
};

const loadCatalog = (outfits: PolyvoreOutfit[], categoryNames: Map<number, string>) => {
  const features = new Map<string, ProductFeature>();
  outfits.forEach((outfit) => outfit.items.forEach((item) => {
    const feature = toFeature(outfit, item, categoryNames);
    if (feature) features.set(feature.productId, feature);
  }));
  return features;
};

const pairKey = (left: string, right: string) => (
  left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`
);

const buildCategoryAssociation = (
  trainingOutfits: PolyvoreOutfit[],
  categoryNames: Map<number, string>,
) => {
  const categoryCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  let baskets = 0;

  trainingOutfits.forEach((outfit) => {
    const categories = new Set(outfit.items
      .filter((item) => inferRole(`${categoryNames.get(item.categoryid) ?? ''} ${item.name}`.toLowerCase()))
      .map((item) => String(item.categoryid)));
    if (categories.size < 2) return;
    baskets += 1;
    const values = [...categories].sort();
    values.forEach((category) => categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1));
    values.forEach((left, index) => values.slice(index + 1).forEach((right) => {
      const key = pairKey(left, right);
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }));
  });

  const rawLift = (left: string, right: string) => {
    if (left === right) return 0;
    const pairCount = pairCounts.get(pairKey(left, right)) ?? 0;
    const leftCount = categoryCounts.get(left) ?? 0;
    const rightCount = categoryCounts.get(right) ?? 0;
    return pairCount && leftCount && rightCount
      ? (pairCount * baskets) / (leftCount * rightCount)
      : 0;
  };
  const maxLift = Math.max(1, ...[...pairCounts.keys()].map((key) => {
    const [left, right] = key.split('\u0000');
    return rawLift(left, right);
  }));

  return {
    baskets,
    normalizedLift: (sourceCategories: string[], candidateCategory: string) => {
      const lift = Math.max(0, ...sourceCategories.map((source) => rawLift(source, candidateCategory)));
      return Math.log1p(lift) / Math.log1p(maxLift);
    },
  };
};

const overlapScore = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0;
  return [...left].filter((value) => right.has(value)).length / Math.max(left.size, right.size);
};

const priceSimilarity = (left: number, right: number) => {
  if (left <= 0 || right <= 0) return 0;
  return Math.max(0, 1 - Math.abs(left - right) / Math.max(left, right));
};

const roleCompatibility = (sourceRoles: OutfitRole[], candidateRole: OutfitRole) => {
  const best = Math.max(...sourceRoles.map((sourceRole) => CART_ROLE_COMPATIBILITY[sourceRole][candidateRole]));
  return sourceRoles.includes(candidateRole) ? Math.min(best, 0.2) : best;
};

const styleCompatibility = (source: ProductFeature, candidate: ProductFeature) => (
  0.40 +
  0.25 * overlapScore(source.colors, candidate.colors) +
  0.20 * priceSimilarity(source.price, candidate.price)
);

const buildValidationDrafts = (
  outfits: PolyvoreOutfit[],
  catalog: Map<string, ProductFeature>,
  limit: number,
) => deterministicOrder(outfits, (outfit) => outfit.set_id).flatMap<CaseDraft>((outfit) => {
  const productIds = outfit.items
    .map((item) => toProductId(outfit.set_id, item.index))
    .filter((productId) => catalog.has(productId));
  if (productIds.length < 2) return [];
  const target = deterministicOrder(productIds, (productId) => `${outfit.set_id}:${productId}`)[0];
  return [{
    caseId: `POLYVORE-VALID-${outfit.set_id}`,
    sourceIds: productIds.filter((productId) => productId !== target),
    relevantId: target,
    officialNegativeIds: [],
  }];
}).slice(0, limit);

const buildTestDrafts = (
  questions: FillInBlankQuestion[],
  catalog: Map<string, ProductFeature>,
) => questions.flatMap<CaseDraft>((question, index) => {
  const relevantId = question.answers[0];
  // Keep every official answer candidate, but evaluate the cart context using
  // only source items representable by the production recommender's seven roles.
  const sourceIds = question.question.filter((productId) => catalog.has(productId));
  if (
    !sourceIds.length ||
    question.answers.length !== 4 ||
    question.answers.some((productId) => !catalog.has(productId))
  ) return [];
  return [{
    caseId: `POLYVORE-TEST-${String(index + 1).padStart(4, '0')}`,
    sourceIds,
    relevantId,
    officialNegativeIds: question.answers.slice(1).filter((productId) => catalog.has(productId)),
  }];
});

const buildCandidateIds = (
  draft: CaseDraft,
  catalog: Map<string, ProductFeature>,
  catalogOrder: ProductFeature[],
  catalogByRole: Map<OutfitRole, ProductFeature[]>,
  candidatesPerCase: number,
) => {
  const target = catalog.get(draft.relevantId) as ProductFeature;
  const excluded = new Set([...draft.sourceIds, draft.relevantId]);
  const candidates = [draft.relevantId];
  const candidateSet = new Set(candidates);
  draft.officialNegativeIds.forEach((productId) => {
    if (!excluded.has(productId) && !candidateSet.has(productId)) {
      candidates.push(productId);
      candidateSet.add(productId);
    }
  });
  if (candidates.length >= candidatesPerCase) return candidates.slice(0, candidatesPerCase);
  const forEachRotated = (
    features: ProductFeature[],
    salt: string,
    callback: (feature: ProductFeature) => boolean,
  ) => {
    if (!features.length) return;
    const offset = Number.parseInt(hashValue(`${draft.caseId}:${salt}`).slice(0, 8), 16) % features.length;
    for (let index = 0; index < features.length; index += 1) {
      if (!callback(features[(offset + index) % features.length])) break;
    }
  };
  const append = (feature: ProductFeature) => {
    if (
      candidates.length < candidatesPerCase &&
      !excluded.has(feature.productId) &&
      !candidateSet.has(feature.productId)
    ) {
      candidates.push(feature.productId);
      candidateSet.add(feature.productId);
    }
  };
  const sameRoleLimit = Math.floor(candidatesPerCase / 2);
  forEachRotated(catalogByRole.get(target.role) ?? [], 'hard', (feature) => {
    append(feature);
    return candidates.length < sameRoleLimit;
  });
  forEachRotated(catalogOrder, 'catalog', (feature) => {
    append(feature);
    return candidates.length < candidatesPerCase;
  });
  return candidates.slice(0, candidatesPerCase);
};

const run = () => {
  const dataDir = path.resolve(getStringArg(
    'data-dir',
    path.resolve(process.cwd(), '..', 'evaluation', 'recommendation', 'data', 'raw', 'polyvore'),
  ));
  const split = getStringArg('split', 'validation');
  if (split !== 'validation' && split !== 'test') throw new Error('split must be validation or test');
  const candidatesPerCase = getPositiveIntegerArg('candidates', DEFAULT_CANDIDATES);
  const casesLimit = getPositiveIntegerArg(
    'cases',
    split === 'validation' ? DEFAULT_VALIDATION_CASES : Number.MAX_SAFE_INTEGER,
  );
  const outputPath = path.resolve(getStringArg(
    'out',
    path.resolve(
      process.cwd(),
      '..',
      'evaluation',
      'recommendation',
      'data',
      'processed',
      `polyvore-cart-${split}.json`,
    ),
  ));
  const categoryNames = parseCategoryNames(path.join(dataDir, 'category_id.txt'));
  const trainingOutfits = readJson<PolyvoreOutfit[]>(path.join(dataDir, 'train_no_dup.json'));
  const evaluationOutfits = readJson<PolyvoreOutfit[]>(path.join(
    dataDir,
    split === 'validation' ? 'valid_no_dup.json' : 'test_no_dup.json',
  ));
  const validationOutfits = split === 'test'
    ? readJson<PolyvoreOutfit[]>(path.join(dataDir, 'valid_no_dup.json'))
    : [];
  const catalog = loadCatalog(
    split === 'test'
      ? [...trainingOutfits, ...validationOutfits, ...evaluationOutfits]
      : evaluationOutfits,
    categoryNames,
  );
  const catalogOrder = deterministicOrder([...catalog.values()], (feature) => feature.productId);
  const catalogByRole = new Map<OutfitRole, ProductFeature[]>();
  catalogOrder.forEach((feature) => {
    const values = catalogByRole.get(feature.role) ?? [];
    values.push(feature);
    catalogByRole.set(feature.role, values);
  });
  const association = buildCategoryAssociation(trainingOutfits, categoryNames);
  const questions = split === 'test'
    ? readJson<FillInBlankQuestion[]>(path.join(dataDir, 'fill_in_blank_test.json'))
    : [];
  const drafts = (split === 'validation'
    ? buildValidationDrafts(evaluationOutfits, catalog, casesLimit)
    : buildTestDrafts(questions, catalog).slice(0, casesLimit));
  const maxLikes = Math.max(1, ...[...catalog.values()].map((feature) => feature.likes));
  const cases = drafts.map<RecommendationBenchmarkCase>((draft) => {
    const sourceFeatures = draft.sourceIds.map((productId) => catalog.get(productId) as ProductFeature);
    const sourceRoles = sourceFeatures.map((feature) => feature.role);
    const sourceCategories = sourceFeatures.map((feature) => feature.categoryId);
    const candidates = buildCandidateIds(
      draft,
      catalog,
      catalogOrder,
      catalogByRole,
      candidatesPerCase,
    )
      .map<RecommendationBenchmarkCandidate>((productId) => {
        const feature = catalog.get(productId) as ProductFeature;
        return {
          productId,
          categoryId: feature.categoryId,
          brandId: null,
          signals: {
            complementaryRole: roleCompatibility(sourceRoles, feature.role),
            styleCompatibility: Math.max(
              ...sourceFeatures.map((source) => styleCompatibility(source, feature)),
            ),
            popularity: Math.log1p(feature.likes) / Math.log1p(maxLikes),
            business: 0,
            associationLift: association.normalizedLift(sourceCategories, feature.categoryId),
          },
        };
      });
    return {
      caseId: draft.caseId,
      context: 'cart',
      relevantProductIds: [draft.relevantId],
      candidates,
    };
  });

  const dataset: RecommendationBenchmarkDataset & { preparation: Record<string, unknown> } = {
    schemaVersion: 1,
    dataset: {
      name: `Polyvore Outfit ${split} Cart completion`,
      source: 'xthan/polyvore-dataset; Learning Fashion Compatibility with Bidirectional LSTMs (ACM MM 2017)',
      split: split === 'validation'
        ? 'Official valid_no_dup outfits; deterministic held-out item and sampled candidates'
        : 'Official test_no_dup outfits and fill_in_blank_test questions; first answer is ground truth',
      notes: split === 'validation'
        ? `A deterministic item is held out from each validation outfit and ranked among ${candidatesPerCase} candidates. Category-level association lift is learned from train_no_dup only. Gender and brand are unavailable; the style proxy uses color words and price similarity.`
        : `All four official FITB answers are retained when their metadata is available and all map to one of the production recommender's seven roles. Unrepresentable source items are excluded from the cart context. The pool is expanded deterministically to ${candidatesPerCase} candidates. Category-level association lift is learned from train_no_dup only. Gender and brand are unavailable; the style proxy uses color words and price similarity.`,
    },
    preparation: {
      trainingOutfits: trainingOutfits.length,
      evaluationOutfits: evaluationOutfits.length,
      catalogItems: catalog.size,
      generatedCases: cases.length,
      candidatesPerCase,
      associationTrainingBaskets: association.baskets,
      officialFillInBlankQuestions: questions.length,
      excludedOfficialQuestions: split === 'test' ? questions.length - cases.length : 0,
    },
    cases,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(dataset)}\n`, 'utf8');
  console.log(JSON.stringify(dataset.preparation, null, 2));
  console.error(`Wrote ${cases.length} ${split} cases to ${outputPath}`);
};

try {
  run();
} catch (error) {
  console.error('Polyvore recommendation preparation failed:', error);
  process.exitCode = 1;
}
