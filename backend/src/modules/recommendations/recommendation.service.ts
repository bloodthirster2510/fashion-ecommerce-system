import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  Cart,
  Inventory,
  Order,
  Product,
  RecommendationEvent,
  RecommendationMerchandisingRule,
  RecommendationRequest,
  RECOMMENDATION_CONTEXTS,
  RECOMMENDATION_EVENT_TYPES,
  UserProductInteraction,
  type IInventory,
  type IProductVariant,
  type InteractionActionType,
  type RecommendationContext,
  type RecommendationEventType,
} from '../../database/models';
import { getFinalPrice, toIdString } from '../sales/sales.helpers';
import type {
  ProductGenderFilter,
  ProductListItem,
} from '../catalog/products/product.types';
import {
  INTERACTION_ACTION_WEIGHTS,
  interactionService,
} from '../interactions/interaction.service';
import {
  RECOMMENDATION_ALGORITHM_VERSION,
  type CartRecommendationInput,
  type RecommendationConversionEventInput,
  type PersonalRecommendationInput,
  type RecommendationEventInput,
  type RecommendationItem,
  type RecommendationReasonCode,
  type RecommendationResponse,
  type RegisterRecommendationRequestInput,
  type SimilarRecommendationInput,
} from './recommendation.types';
import {
  applyRecommendationDiversity,
  CART_RULE_ONLY_FALLBACK_WEIGHTS,
  calculateCartRecommendationScore,
  calculatePersonalRecommendationScore,
  calculateSimilarRecommendationScore,
} from './recommendation-scoring';
import { getCategoryAssociationModel } from './recommendation-association.service';

export {
  applyRecommendationDiversity,
  calculateCartRecommendationScore,
  calculatePersonalRecommendationScore,
  calculateSimilarRecommendationScore,
} from './recommendation-scoring';

export class RecommendationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RecommendationServiceError';
  }
}

type PopulatedBrand = {
  _id: Types.ObjectId;
  name: string;
  image?: string;
};

type PopulatedCategory = {
  _id: Types.ObjectId;
  name: string;
  gender?: ProductGenderFilter;
  image?: string;
};

type RecommendationProductDocument = {
  _id: Types.ObjectId;
  category_id: Types.ObjectId | PopulatedCategory | null;
  name: string;
  brand_id: Types.ObjectId | PopulatedBrand | null;
  variant: IProductVariant[];
  description: string;
  product_image: string;
  isActive: boolean;
  sold_quantity: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryStockDocument = Pick<
  IInventory,
  'productId' | 'variantId' | 'colorVariantId' | 'size' | 'availableQuantity'
>;

export type OutfitRole =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'set'
  | 'shoes'
  | 'accessory'
  | 'outerwear';

type ProductFeature = {
  productId: string;
  categoryId: string;
  gender?: ProductGenderFilter;
  brandId: string;
  role: OutfitRole;
  colors: Set<string>;
  fitTypes: Set<string>;
  price: number;
  priceBucket: string;
  isSale: boolean;
  isNew: boolean;
  soldQuantity: number;
  averageRating: number;
  reviewCount: number;
};

type ScoredProduct = {
  product: RecommendationProductDocument;
  productItem: ProductListItem;
  score: number;
  reasonCodes: RecommendationReasonCode[];
};

type PreferenceProfile = {
  categoryScores: Map<string, number>;
  brandScores: Map<string, number>;
  colorScores: Map<string, number>;
  genderScores: Map<string, number>;
  priceBucketScores: Map<string, number>;
};

type ProductFilter = Record<string, unknown>;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const CANDIDATE_POOL_LIMIT = 300;
const RECENT_PURCHASE_EXCLUSION_DAYS = 30;
const INTERACTION_LOOKBACK_DAYS = 180;
const NEW_PRODUCT_DAYS = 30;

const CART_ROLE_COMPATIBILITY: Record<OutfitRole, Record<OutfitRole, number>> = {
  top: { top: 0.1, bottom: 1, dress: 0.15, set: 0.2, shoes: 0.55, accessory: 0.55, outerwear: 0.7 },
  bottom: { top: 1, bottom: 0.1, dress: 0.15, set: 0.2, shoes: 0.75, accessory: 0.5, outerwear: 0.65 },
  dress: { top: 0.2, bottom: 0.2, dress: 0.1, set: 0.15, shoes: 1, accessory: 0.7, outerwear: 0.8 },
  set: { top: 0.2, bottom: 0.2, dress: 0.15, set: 0.1, shoes: 1, accessory: 0.7, outerwear: 0.8 },
  shoes: { top: 0.8, bottom: 0.85, dress: 0.9, set: 0.9, shoes: 0.1, accessory: 0.4, outerwear: 0.6 },
  accessory: { top: 0.75, bottom: 0.7, dress: 0.8, set: 0.8, shoes: 0.5, accessory: 0.1, outerwear: 0.6 },
  outerwear: { top: 1, bottom: 0.9, dress: 0.8, set: 0.8, shoes: 0.65, accessory: 0.5, outerwear: 0.1 },
};

const REASON_TEXT: Record<RecommendationReasonCode, string> = {
  same_category: 'Cùng danh mục',
  same_brand: 'Cùng thương hiệu',
  same_gender: 'Cùng nhóm thời trang',
  same_color: 'Màu sắc tương tự',
  similar_price: 'Khoảng giá tương tự',
  preferred_category: 'Hợp danh mục bạn quan tâm',
  preferred_brand: 'Hợp thương hiệu bạn quan tâm',
  preferred_color: 'Hợp màu bạn hay xem',
  completes_outfit: 'Hoàn thiện set đồ',
  matches_cart_style: 'Hợp phong cách giỏ hàng',
  frequently_bought_together: 'Thường được mua cùng nhau',
  admin_pinned: 'Nổi bật',
  popular: 'Đang bán chạy',
  on_sale: 'Đang giảm giá',
  new_arrival: 'Hàng mới',
};

const isRecommendationContext = (value: string): value is RecommendationContext =>
  RECOMMENDATION_CONTEXTS.includes(value as RecommendationContext);

const isRecommendationEventType = (value: string): value is RecommendationEventType =>
  RECOMMENDATION_EVENT_TYPES.includes(value as RecommendationEventType);

const clampLimit = (limit?: number) => {
  if (!Number.isInteger(limit) || !limit || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);
};

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new RecommendationServiceError(`Invalid ${fieldName}`, 400);
  }

  return new Types.ObjectId(id);
};

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const normalizeRoleText = (value?: string | null) => (
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? ''
);

const hasAnyRoleKeyword = (value: string, keywords: string[]) => {
  const paddedValue = ` ${value} `;
  return keywords.some((keyword) => paddedValue.includes(` ${keyword} `));
};

export const inferOutfitRole = ({
  name,
  categoryName,
}: {
  name: string;
  categoryName?: string | null;
}): OutfitRole => {
  const normalizedName = normalizeRoleText(name);
  const normalizedCategory = normalizeRoleText(categoryName);
  const haystack = `${normalizedName} ${normalizedCategory}`.trim();

  if (hasAnyRoleKeyword(haystack, ['giay', 'dep', 'sandal', 'sneaker', 'boot', 'loafer', 'slipon'])) {
    return 'shoes';
  }

  if (
    hasAnyRoleKeyword(normalizedCategory, ['bo the thao', 'set bo', 'do bo']) ||
    normalizedName.startsWith('bo ') ||
    normalizedName.startsWith('do bo ')
  ) {
    return 'set';
  }

  if (hasAnyRoleKeyword(haystack, ['chan vay', 'vay', 'dam', 'dress'])) return 'dress';
  if (hasAnyRoleKeyword(haystack, ['khoac', 'blazer', 'jacket', 'cardigan', 'hoodie', 'coat', 'outerwear'])) {
    return 'outerwear';
  }
  if (hasAnyRoleKeyword(haystack, ['quan', 'jean', 'short', 'pants', 'trouser'])) return 'bottom';
  if (hasAnyRoleKeyword(haystack, ['tui', 'that lung', 'mu', 'non', 'khan', 'kinh', 'phu kien', 'dong ho', 'trang suc'])) {
    return 'accessory';
  }

  return 'top';
};

const getRequestId = () => `rec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

const normalizeSessionId = (value?: string | null) => {
  const sessionId = value?.trim();

  if (!sessionId) {
    return null;
  }

  if (sessionId.length > 128) {
    throw new RecommendationServiceError('Invalid sessionId', 400);
  }

  return sessionId;
};

const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

const getNewProductCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_PRODUCT_DAYS);
  return cutoff;
};

const isNewProduct = (createdAt: Date) => createdAt >= getNewProductCutoff();

const getRelationId = (relation: Types.ObjectId | { _id: Types.ObjectId } | null | undefined) => {
  if (!relation) {
    return '';
  }

  if (relation instanceof Types.ObjectId) {
    return toIdString(relation);
  }

  return toIdString(relation._id);
};

const isPopulatedBrand = (
  relation: RecommendationProductDocument['brand_id'],
): relation is PopulatedBrand => Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);

const isPopulatedCategory = (
  relation: RecommendationProductDocument['category_id'],
): relation is PopulatedCategory => Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);

const groupInventoryByProductId = (inventoryItems: InventoryStockDocument[]) => {
  const inventoryByProductId = new Map<string, InventoryStockDocument[]>();

  inventoryItems.forEach((inventory) => {
    const productId = toIdString(inventory.productId);
    const existingItems = inventoryByProductId.get(productId) ?? [];
    existingItems.push(inventory);
    inventoryByProductId.set(productId, existingItems);
  });

  return inventoryByProductId;
};

const getAvailableQuantityForVariant = (
  variant: IProductVariant,
  inventoryItems: InventoryStockDocument[],
) => {
  const variantId = toIdString(variant._id);

  return inventoryItems
    .filter((inventory) => toIdString(inventory.variantId) === variantId && inventory.availableQuantity > 0)
    .reduce((sum, inventory) => sum + inventory.availableQuantity, 0);
};

const hasAvailableInventoryForVariant = (
  variant: IProductVariant,
  inventoryItems: InventoryStockDocument[],
) => getAvailableQuantityForVariant(variant, inventoryItems) > 0;

const selectDisplayVariant = (
  variants: IProductVariant[],
  inventoryItems: InventoryStockDocument[],
) => (
  variants.find((variant) => variant.isActive && hasAvailableInventoryForVariant(variant, inventoryItems)) ??
  variants.find((variant) => variant.isActive) ??
  variants[0]
);

const mapProductListItem = (
  product: RecommendationProductDocument,
  inventoryByProductId: Map<string, InventoryStockDocument[]>,
): ProductListItem => {
  const productInventory = inventoryByProductId.get(toIdString(product._id)) ?? [];
  const displayVariant = selectDisplayVariant(product.variant, productInventory);
  const originalPrice = displayVariant?.price ?? 0;
  const discount = displayVariant?.discount ?? 0;
  const brand = isPopulatedBrand(product.brand_id)
    ? {
        _id: getRelationId(product.brand_id),
        name: product.brand_id.name,
        image: product.brand_id.image,
      }
    : null;
  const category = isPopulatedCategory(product.category_id)
    ? {
        _id: getRelationId(product.category_id),
        name: product.category_id.name,
        gender: product.category_id.gender,
        image: product.category_id.image,
      }
    : null;

  return {
    _id: toIdString(product._id),
    name: product.name,
    image: displayVariant?.colors?.[0]?.image || product.product_image,
    price: originalPrice,
    originalPrice,
    discount,
    finalPrice: getFinalPrice(originalPrice, discount),
    isSale: discount > 0,
    isNew: isNewProduct(product.createdAt),
    isAvailable: Boolean(
      displayVariant?.isActive && hasAvailableInventoryForVariant(displayVariant, productInventory),
    ),
    soldQuantity: product.sold_quantity,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    brand,
    category,
  };
};

const getProductFeature = (
  product: RecommendationProductDocument,
  inventoryByProductId: Map<string, InventoryStockDocument[]>,
): ProductFeature => {
  const productInventory = inventoryByProductId.get(toIdString(product._id)) ?? [];
  const displayVariant = selectDisplayVariant(product.variant, productInventory);
  const originalPrice = displayVariant?.price ?? 0;
  const discount = displayVariant?.discount ?? 0;
  const finalPrice = getFinalPrice(originalPrice, discount);

  return {
    productId: toIdString(product._id),
    categoryId: getRelationId(product.category_id),
    gender: isPopulatedCategory(product.category_id) ? product.category_id.gender : undefined,
    brandId: getRelationId(product.brand_id),
    role: inferOutfitRole({
      name: product.name,
      categoryName: isPopulatedCategory(product.category_id) ? product.category_id.name : undefined,
    }),
    colors: new Set(
      product.variant.flatMap((variant) =>
        variant.colors.map((color) => normalizeText(color.color)).filter(Boolean),
      ),
    ),
    fitTypes: new Set(product.variant.map((variant) => toIdString(variant.fitTypeId)).filter(Boolean)),
    price: finalPrice,
    priceBucket: getPriceBucket(finalPrice),
    isSale: discount > 0,
    isNew: isNewProduct(product.createdAt),
    soldQuantity: product.sold_quantity,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
  };
};

const getPriceBucket = (price: number) => {
  if (price <= 0) return 'unknown';
  if (price < 200000) return 'under_200k';
  if (price < 500000) return '200k_500k';
  if (price < 1000000) return '500k_1m';
  return 'over_1m';
};

const getPriceSimilarity = (left: number, right: number) => {
  if (left <= 0 || right <= 0) return 0;
  const maxPrice = Math.max(left, right);
  return Math.max(0, 1 - Math.abs(left - right) / maxPrice);
};

const getSetOverlapScore = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0;
  const intersectionSize = [...left].filter((item) => right.has(item)).length;
  return intersectionSize / Math.max(left.size, right.size);
};

const getContentSimilarityScore = (source: ProductFeature, candidate: ProductFeature) => {
  const categoryScore = source.categoryId && source.categoryId === candidate.categoryId ? 1 : 0;
  const genderScore = source.gender && source.gender === candidate.gender ? 1 : 0;
  const brandScore = source.brandId && source.brandId === candidate.brandId ? 1 : 0;
  const colorScore = getSetOverlapScore(source.colors, candidate.colors);
  const fitScore = getSetOverlapScore(source.fitTypes, candidate.fitTypes);
  const priceScore = getPriceSimilarity(source.price, candidate.price);

  return (
    0.35 * categoryScore +
    0.15 * genderScore +
    0.10 * brandScore +
    0.15 * colorScore +
    0.10 * fitScore +
    0.15 * priceScore
  );
};

const getBinaryContentVector = (feature: ProductFeature) => new Set([
  ...(feature.categoryId ? [`category:${feature.categoryId}`] : []),
  `role:${feature.role}`,
  ...(feature.gender ? [`gender:${feature.gender}`] : []),
  ...(feature.brandId ? [`brand:${feature.brandId}`] : []),
  ...[...feature.colors].map((color) => `color:${color}`),
  ...[...feature.fitTypes].map((fitType) => `fit:${fitType}`),
  `price:${feature.priceBucket}`,
]);

export const getBinaryCosineSimilarityScore = (
  source: ProductFeature,
  candidate: ProductFeature,
) => {
  const sourceVector = getBinaryContentVector(source);
  const candidateVector = getBinaryContentVector(candidate);
  const dotProduct = [...sourceVector].filter((value) => candidateVector.has(value)).length;
  return dotProduct / Math.sqrt(sourceVector.size * candidateVector.size);
};

export const getCartComplementaryRoleScore = (
  sourceRoles: OutfitRole[],
  candidateRole: OutfitRole,
) => {
  if (!sourceRoles.length) return 0;

  const bestScore = Math.max(
    ...sourceRoles.map((sourceRole) => CART_ROLE_COMPATIBILITY[sourceRole][candidateRole]),
  );

  return sourceRoles.includes(candidateRole) ? Math.min(bestScore, 0.2) : bestScore;
};

const getGenderCompatibilityScore = (source: ProductFeature, candidate: ProductFeature) => {
  if (!source.gender || !candidate.gender) return 0.7;
  return source.gender === candidate.gender ? 1 : 0.25;
};

const getCartStyleCompatibilityScore = (source: ProductFeature, candidate: ProductFeature) => {
  const genderScore = getGenderCompatibilityScore(source, candidate);
  const colorScore = getSetOverlapScore(source.colors, candidate.colors);
  const priceScore = getPriceSimilarity(source.price, candidate.price);
  const brandScore = source.brandId && source.brandId === candidate.brandId ? 1 : 0;

  return 0.40 * genderScore + 0.25 * colorScore + 0.20 * priceScore + 0.15 * brandScore;
};

const getBestCartSourceFeature = (
  sourceFeatures: ProductFeature[],
  candidateFeature: ProductFeature,
) => {
  let bestSource = sourceFeatures[0];
  let bestStyleScore = 0;
  let bestCombinedScore = Number.NEGATIVE_INFINITY;

  sourceFeatures.forEach((sourceFeature) => {
    const roleScore = CART_ROLE_COMPATIBILITY[sourceFeature.role][candidateFeature.role];
    const styleScore = getCartStyleCompatibilityScore(sourceFeature, candidateFeature);
    const combinedScore = 0.7 * roleScore + 0.3 * styleScore;

    if (combinedScore > bestCombinedScore) {
      bestSource = sourceFeature;
      bestStyleScore = styleScore;
      bestCombinedScore = combinedScore;
    }
  });

  return { sourceFeature: bestSource, styleScore: bestStyleScore };
};

const getPopularityScore = (feature: ProductFeature) => {
  const soldScore = Math.min(feature.soldQuantity / 100, 1);
  const reviewScore = Math.min(feature.reviewCount / 50, 1);
  const ratingScore = Math.min(feature.averageRating / 5, 1);

  return 0.50 * soldScore + 0.30 * reviewScore + 0.20 * ratingScore;
};

const getBusinessScore = (feature: ProductFeature) => (
  (feature.isSale ? 0.55 : 0) + (feature.isNew ? 0.45 : 0)
);

const addReasonCode = (
  reasonCodes: RecommendationReasonCode[],
  code: RecommendationReasonCode,
) => {
  if (!reasonCodes.includes(code)) {
    reasonCodes.push(code);
  }
};

const getSimilarReasonCodes = (
  source: ProductFeature,
  candidate: ProductFeature,
): RecommendationReasonCode[] => {
  const reasonCodes: RecommendationReasonCode[] = [];

  if (source.categoryId && source.categoryId === candidate.categoryId) addReasonCode(reasonCodes, 'same_category');
  if (source.brandId && source.brandId === candidate.brandId) addReasonCode(reasonCodes, 'same_brand');
  if (source.gender && source.gender === candidate.gender) addReasonCode(reasonCodes, 'same_gender');
  if (getSetOverlapScore(source.colors, candidate.colors) > 0) addReasonCode(reasonCodes, 'same_color');
  if (getPriceSimilarity(source.price, candidate.price) >= 0.75) addReasonCode(reasonCodes, 'similar_price');
  if (getPopularityScore(candidate) >= 0.35) addReasonCode(reasonCodes, 'popular');
  if (candidate.isSale) addReasonCode(reasonCodes, 'on_sale');
  if (candidate.isNew) addReasonCode(reasonCodes, 'new_arrival');

  return reasonCodes.length ? reasonCodes : ['popular'];
};

const getCartReasonCodes = ({
  source,
  candidate,
  complementaryRole,
  styleCompatibility,
}: {
  source: ProductFeature;
  candidate: ProductFeature;
  complementaryRole: number;
  styleCompatibility: number;
}): RecommendationReasonCode[] => {
  const reasonCodes: RecommendationReasonCode[] = [];

  if (complementaryRole >= 0.45) addReasonCode(reasonCodes, 'completes_outfit');
  if (styleCompatibility >= 0.45) addReasonCode(reasonCodes, 'matches_cart_style');
  if (source.gender && source.gender === candidate.gender) addReasonCode(reasonCodes, 'same_gender');
  if (getSetOverlapScore(source.colors, candidate.colors) > 0) addReasonCode(reasonCodes, 'same_color');
  if (source.brandId && source.brandId === candidate.brandId) addReasonCode(reasonCodes, 'same_brand');
  if (getPriceSimilarity(source.price, candidate.price) >= 0.75) addReasonCode(reasonCodes, 'similar_price');
  if (getPopularityScore(candidate) >= 0.35) addReasonCode(reasonCodes, 'popular');
  if (candidate.isSale) addReasonCode(reasonCodes, 'on_sale');
  if (candidate.isNew) addReasonCode(reasonCodes, 'new_arrival');

  return reasonCodes.length ? reasonCodes : ['popular'];
};

const getReasonText = (reasonCodes: RecommendationReasonCode[]) =>
  reasonCodes.slice(0, 3).map((code) => REASON_TEXT[code]).join(', ');

const getRoundedScore = (score: number) => Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000;

const fetchProducts = async (
  filter: ProductFilter,
  limit = CANDIDATE_POOL_LIMIT,
) => (
  Product.find({ ...filter, isActive: true })
    .populate('brand_id', '_id name image')
    .populate('category_id', '_id name gender image')
    .sort({ sold_quantity: -1, averageRating: -1, reviewCount: -1, createdAt: -1 })
    .limit(limit)
    .lean<RecommendationProductDocument[]>()
);

const getInventoryByProductId = async (products: RecommendationProductDocument[]) => {
  if (!products.length) {
    return new Map<string, InventoryStockDocument[]>();
  }

  const inventoryItems = await Inventory.find({
    productId: { $in: products.map((product) => product._id) },
    availableQuantity: { $gt: 0 },
  }).lean<InventoryStockDocument[]>();

  return groupInventoryByProductId(inventoryItems);
};

const mergeProducts = (
  primary: RecommendationProductDocument[],
  secondary: RecommendationProductDocument[],
) => {
  const productById = new Map<string, RecommendationProductDocument>();

  [...primary, ...secondary].forEach((product) => {
    productById.set(toIdString(product._id), product);
  });

  return [...productById.values()];
};

const toRecommendationResponse = (
  scoredProducts: ScoredProduct[],
  limit: number,
  fallbackUsed: boolean,
): RecommendationResponse => {
  const requestId = getRequestId();
  const selectedItems = applyRecommendationDiversity(
    scoredProducts
      .filter((item) => item.productItem.isAvailable)
      .sort((left, right) => right.score - left.score),
    limit,
  );

  return {
    requestId,
    algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
    fallbackUsed,
    items: selectedItems.map<RecommendationItem>((item, index) => ({
      product: item.productItem,
      score: getRoundedScore(item.score),
      rank: index + 1,
      reason: getReasonText(item.reasonCodes),
      reasonCodes: item.reasonCodes,
    })),
  };
};

export const mergeMerchandisedItems = (
  response: RecommendationResponse,
  pinnedItems: RecommendationItem[],
  limit: number,
): RecommendationResponse => {
  const pinnedIdSet = new Set(pinnedItems.map((item) => item.product._id));
  const items = [
    ...pinnedItems,
    ...response.items.filter((item) => !pinnedIdSet.has(item.product._id)),
  ].slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));

  return { ...response, items };
};

const applyMerchandising = async (
  response: RecommendationResponse,
  context: RecommendationContext,
  limit: number,
  excludedProductIds = new Set<string>(),
): Promise<RecommendationResponse> => {
  const now = new Date();
  const rule = await RecommendationMerchandisingRule.findOne({
    context,
    enabled: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }] },
    ],
  }).select('pinnedProductIds').lean<{ pinnedProductIds?: Types.ObjectId[] } | null>();

  const pinnedIds = (rule?.pinnedProductIds ?? [])
    .map(String)
    .filter((id) => !excludedProductIds.has(id));
  if (!pinnedIds.length) return response;

  const products = await fetchProducts({
    _id: { $in: pinnedIds.map((id) => new Types.ObjectId(id)) },
  }, pinnedIds.length);
  const inventoryByProductId = await getInventoryByProductId(products);
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const pinnedItems = pinnedIds.flatMap<RecommendationItem>((productId) => {
    const product = productById.get(productId);
    if (!product) return [];
    const productItem = mapProductListItem(product, inventoryByProductId);
    if (!productItem.isAvailable || productItem.finalPrice <= 0) return [];
    return [{
      product: productItem,
      score: 1,
      rank: 0,
      reason: REASON_TEXT.admin_pinned,
      reasonCodes: ['admin_pinned'],
      merchandisingSource: 'admin_pinned',
    }];
  });
  if (!pinnedItems.length) return response;

  return mergeMerchandisedItems(response, pinnedItems, limit);
};

const getFallbackRecommendations = async ({
  limit,
  excludeProductIds = new Set<string>(),
}: {
  limit: number;
  excludeProductIds?: Set<string>;
}) => {
  const excludedObjectIds = [...excludeProductIds]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const products = await fetchProducts(
    excludedObjectIds.length ? { _id: { $nin: excludedObjectIds } } : {},
    Math.max(CANDIDATE_POOL_LIMIT, limit),
  );
  const inventoryByProductId = await getInventoryByProductId(products);

  return products.map<ScoredProduct>((product) => {
    const productItem = mapProductListItem(product, inventoryByProductId);
    const feature = getProductFeature(product, inventoryByProductId);
    const reasonCodes: RecommendationReasonCode[] = ['popular'];

    if (feature.isSale) reasonCodes.push('on_sale');
    if (feature.isNew) reasonCodes.push('new_arrival');

    return {
      product,
      productItem,
      score: 0.7 * getPopularityScore(feature) + 0.3 * getBusinessScore(feature),
      reasonCodes,
    };
  });
};

const getSimilarCandidateFilter = (sourceFeature: ProductFeature) => {
  const conditions: ProductFilter[] = [];

  if (sourceFeature.categoryId) conditions.push({ category_id: sourceFeature.categoryId });
  if (sourceFeature.brandId) conditions.push({ brand_id: sourceFeature.brandId });
  if (sourceFeature.colors.size) {
    conditions.push({ 'variant.colors.color': { $in: [...sourceFeature.colors] } });
  }

  return conditions.length ? { $or: conditions } : {};
};

const getSimilarRecommendationsCore = async (
  input: SimilarRecommendationInput,
): Promise<RecommendationResponse> => {
  const limit = clampLimit(input.limit);
  const productId = assertObjectId(input.productId, 'productId');
  const sourceProducts = await fetchProducts({ _id: productId }, 1);
  const sourceProduct = sourceProducts[0];

  if (!sourceProduct) {
    throw new RecommendationServiceError('Product not found', 404);
  }

  const sourceInventoryByProductId = await getInventoryByProductId([sourceProduct]);
  const sourceFeature = getProductFeature(sourceProduct, sourceInventoryByProductId);
  const candidateFilter = {
    ...getSimilarCandidateFilter(sourceFeature),
    _id: { $ne: productId },
  };
  const [primaryCandidates, broadCandidates] = await Promise.all([
    fetchProducts(candidateFilter, CANDIDATE_POOL_LIMIT),
    fetchProducts({ _id: { $ne: productId } }, Math.max(limit * 4, 40)),
  ]);
  const candidates = mergeProducts(primaryCandidates, broadCandidates);
  const inventoryByProductId = await getInventoryByProductId(candidates);
  const scoredProducts = candidates.map<ScoredProduct>((candidate) => {
    const candidateFeature = getProductFeature(candidate, inventoryByProductId);
    const contentSimilarity = getContentSimilarityScore(sourceFeature, candidateFeature);
    const cosineSimilarity = getBinaryCosineSimilarityScore(sourceFeature, candidateFeature);
    const popularity = getPopularityScore(candidateFeature);
    const business = getBusinessScore(candidateFeature);
    const score = calculateSimilarRecommendationScore({
      contentSimilarity,
      cosineSimilarity,
      popularity,
      business,
    });

    return {
      product: candidate,
      productItem: mapProductListItem(candidate, inventoryByProductId),
      score,
      reasonCodes: getSimilarReasonCodes(sourceFeature, candidateFeature),
    };
  });

  const response = toRecommendationResponse(scoredProducts, limit, false);
  if (response.items.length) {
    return response;
  }

  return toRecommendationResponse(
    await getFallbackRecommendations({ limit, excludeProductIds: new Set([input.productId]) }),
    limit,
    true,
  );
};

const getCartRecommendationsCore = async (
  input: CartRecommendationInput,
): Promise<RecommendationResponse> => {
  const limit = clampLimit(input.limit);
  const userId = assertObjectId(input.userId, 'userId');
  const cart = await Cart.findOne({ user_id: userId })
    .select('product_list.productId')
    .lean<{ product_list?: Array<{ productId: Types.ObjectId }> } | null>();
  const cartProductIds = new Set(
    (cart?.product_list ?? []).map((item) => toIdString(item.productId)).filter(Boolean),
  );

  if (!cartProductIds.size) {
    return toRecommendationResponse(
      await getFallbackRecommendations({ limit }),
      limit,
      true,
    );
  }

  const sourceProducts = await fetchProducts({
    _id: {
      $in: [...cartProductIds]
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id)),
    },
  });
  const sourceInventoryByProductId = await getInventoryByProductId(sourceProducts);
  const sourceFeatures = sourceProducts.map((product) => getProductFeature(product, sourceInventoryByProductId));

  if (!sourceFeatures.length) {
    return toRecommendationResponse(
      await getFallbackRecommendations({ limit, excludeProductIds: cartProductIds }),
      limit,
      true,
    );
  }

  const candidates = await fetchProducts({
    _id: {
      $nin: [...cartProductIds]
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id)),
    },
  });
  const inventoryByProductId = await getInventoryByProductId(candidates);
  const sourceRoles = sourceFeatures.map((feature) => feature.role);
  const sourceCategoryIds = sourceFeatures.map((feature) => feature.categoryId).filter(Boolean);
  const associationModel = await getCategoryAssociationModel();
  const scoredProducts = candidates.map<ScoredProduct>((candidate) => {
    const candidateFeature = getProductFeature(candidate, inventoryByProductId);
    const roleScore = getCartComplementaryRoleScore(sourceRoles, candidateFeature.role);
    const genderCompatibility = Math.max(
      ...sourceFeatures.map((sourceFeature) => (
        getGenderCompatibilityScore(sourceFeature, candidateFeature)
      )),
    );
    const complementaryRole = roleScore * genderCompatibility;
    const bestSource = getBestCartSourceFeature(sourceFeatures, candidateFeature);
    const popularity = getPopularityScore(candidateFeature);
    const business = getBusinessScore(candidateFeature);
    const associationLift = associationModel.score(
      sourceCategoryIds,
      candidateFeature.categoryId,
    );
    const score = calculateCartRecommendationScore({
      complementaryRole,
      styleCompatibility: bestSource.styleScore,
      popularity,
      business,
      associationLift,
    }, associationModel.hasEvidence ? undefined : CART_RULE_ONLY_FALLBACK_WEIGHTS);

    return {
      product: candidate,
      productItem: mapProductListItem(candidate, inventoryByProductId),
      score,
      reasonCodes: [
        ...getCartReasonCodes({
          source: bestSource.sourceFeature,
          candidate: candidateFeature,
          complementaryRole,
          styleCompatibility: bestSource.styleScore,
        }),
        ...(associationLift > 0 ? ['frequently_bought_together' as const] : []),
      ],
    };
  });

  const response = toRecommendationResponse(scoredProducts, limit, false);
  if (response.items.length) {
    return response;
  }

  return toRecommendationResponse(
    await getFallbackRecommendations({ limit, excludeProductIds: cartProductIds }),
    limit,
    true,
  );
};

const getDecay = (createdAt: Date) => {
  const ageDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);

  if (ageDays < 7) return 1;
  if (ageDays < 30) return 0.7;
  if (ageDays < 90) return 0.4;
  return 0.2;
};

const addScore = (scores: Map<string, number>, key: string | undefined, value: number) => {
  if (!key) return;
  scores.set(key, (scores.get(key) ?? 0) + value);
};

const getMaxScore = (scores: Map<string, number>) => Math.max(1, ...scores.values());

const getScoreRatio = (scores: Map<string, number>, key: string | undefined) => {
  if (!key) return 0;
  return (scores.get(key) ?? 0) / getMaxScore(scores);
};

const getTopKeys = (scores: Map<string, number>, limit: number) =>
  [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);

const buildPreferenceProfile = (
  interactions: Array<{
    productId?: Types.ObjectId | null;
    actionType: InteractionActionType;
    weight: number;
    createdAt: Date;
  }>,
  productById: Map<string, RecommendationProductDocument>,
  inventoryByProductId: Map<string, InventoryStockDocument[]>,
) => {
  const profile: PreferenceProfile = {
    categoryScores: new Map(),
    brandScores: new Map(),
    colorScores: new Map(),
    genderScores: new Map(),
    priceBucketScores: new Map(),
  };

  interactions.forEach((interaction) => {
    const product = productById.get(toIdString(interaction.productId));
    if (!product) return;

    const feature = getProductFeature(product, inventoryByProductId);
    const baseWeight = interaction.weight || INTERACTION_ACTION_WEIGHTS[interaction.actionType];
    const weight = baseWeight * getDecay(interaction.createdAt);

    addScore(profile.categoryScores, feature.categoryId, weight);
    addScore(profile.brandScores, feature.brandId, weight);
    addScore(profile.genderScores, feature.gender, weight);
    addScore(profile.priceBucketScores, feature.priceBucket, weight);
    feature.colors.forEach((color) => addScore(profile.colorScores, color, weight / Math.max(1, feature.colors.size)));
  });

  return profile;
};

const hasProfileSignal = (profile: PreferenceProfile) =>
  profile.categoryScores.size > 0 ||
  profile.brandScores.size > 0 ||
  profile.colorScores.size > 0 ||
  profile.genderScores.size > 0 ||
  profile.priceBucketScores.size > 0;

const getProfileMatchScore = (profile: PreferenceProfile, feature: ProductFeature) => {
  const colorScore = feature.colors.size
    ? [...feature.colors].reduce((sum, color) => sum + getScoreRatio(profile.colorScores, color), 0) /
      feature.colors.size
    : 0;

  return (
    0.35 * getScoreRatio(profile.categoryScores, feature.categoryId) +
    0.20 * getScoreRatio(profile.brandScores, feature.brandId) +
    0.15 * colorScore +
    0.15 * getScoreRatio(profile.genderScores, feature.gender) +
    0.15 * getScoreRatio(profile.priceBucketScores, feature.priceBucket)
  );
};

const getPreferenceReasonCodes = (
  profile: PreferenceProfile,
  feature: ProductFeature,
): RecommendationReasonCode[] => {
  const reasonCodes: RecommendationReasonCode[] = [];

  if (getScoreRatio(profile.categoryScores, feature.categoryId) > 0) addReasonCode(reasonCodes, 'preferred_category');
  if (getScoreRatio(profile.brandScores, feature.brandId) > 0) addReasonCode(reasonCodes, 'preferred_brand');
  if ([...feature.colors].some((color) => getScoreRatio(profile.colorScores, color) > 0)) {
    addReasonCode(reasonCodes, 'preferred_color');
  }
  if (getPopularityScore(feature) >= 0.35) addReasonCode(reasonCodes, 'popular');
  if (feature.isSale) addReasonCode(reasonCodes, 'on_sale');
  if (feature.isNew) addReasonCode(reasonCodes, 'new_arrival');

  return reasonCodes.length ? reasonCodes : ['popular'];
};

const getRecentPurchasedProductIds = async (userId?: string | null) => {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return new Set<string>();
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_PURCHASE_EXCLUSION_DAYS);
  const orders = await Order.find({
    user_id: new Types.ObjectId(userId),
    createdAt: { $gte: cutoff },
    status: { $nin: ['cancelled', 'returned'] },
  }).select('order_list.productId').lean<Array<{ order_list: Array<{ productId: Types.ObjectId }> }>>();

  return new Set(
    orders.flatMap((order) => order.order_list.map((item) => toIdString(item.productId))),
  );
};

const getInteractionFilter = (input: PersonalRecommendationInput) => {
  const lookbackCutoff = new Date();
  lookbackCutoff.setDate(lookbackCutoff.getDate() - INTERACTION_LOOKBACK_DAYS);

  if (input.userId && Types.ObjectId.isValid(input.userId)) {
    return {
      userId: new Types.ObjectId(input.userId),
      productId: { $ne: null },
      createdAt: { $gte: lookbackCutoff },
    };
  }

  const sessionId = input.sessionId?.trim();
  if (sessionId) {
    return {
      sessionId,
      productId: { $ne: null },
      createdAt: { $gte: lookbackCutoff },
    };
  }

  return null;
};

const getPersonalCandidateFilter = (
  profile: PreferenceProfile,
  excludedIds: Set<string>,
): ProductFilter => {
  const conditions: ProductFilter[] = [];
  const categoryIds = getTopKeys(profile.categoryScores, 5);
  const brandIds = getTopKeys(profile.brandScores, 5);
  const colors = getTopKeys(profile.colorScores, 8);

  if (categoryIds.length) conditions.push({ category_id: { $in: categoryIds } });
  if (brandIds.length) conditions.push({ brand_id: { $in: brandIds } });
  if (colors.length) conditions.push({ 'variant.colors.color': { $in: colors } });

  return {
    ...(conditions.length ? { $or: conditions } : {}),
    ...(excludedIds.size
      ? {
          _id: {
            $nin: [...excludedIds]
              .filter((id) => Types.ObjectId.isValid(id))
              .map((id) => new Types.ObjectId(id)),
          },
        }
      : {}),
  };
};

const getPersonalRecommendationsCore = async (
  input: PersonalRecommendationInput,
): Promise<RecommendationResponse> => {
  const limit = clampLimit(input.limit);
  const interactionFilter = getInteractionFilter(input);

  if (!interactionFilter) {
    return toRecommendationResponse(await getFallbackRecommendations({ limit }), limit, true);
  }

  const interactions = await UserProductInteraction.find(interactionFilter)
    .sort({ createdAt: -1 })
    .limit(120)
    .lean<Array<{
      productId?: Types.ObjectId | null;
      actionType: InteractionActionType;
      weight: number;
      createdAt: Date;
    }>>();

  if (!interactions.length) {
    return toRecommendationResponse(await getFallbackRecommendations({ limit }), limit, true);
  }

  const interactedProductIds = Array.from(
    new Set(interactions.map((interaction) => toIdString(interaction.productId)).filter(Boolean)),
  );
  const sourceProducts = await fetchProducts({
    _id: { $in: interactedProductIds.map((id) => new Types.ObjectId(id)) },
  });
  const sourceInventoryByProductId = await getInventoryByProductId(sourceProducts);
  const sourceProductById = new Map(sourceProducts.map((product) => [toIdString(product._id), product]));
  const profile = buildPreferenceProfile(interactions, sourceProductById, sourceInventoryByProductId);

  if (!hasProfileSignal(profile)) {
    return toRecommendationResponse(await getFallbackRecommendations({ limit }), limit, true);
  }

  const recentPurchasedIds = await getRecentPurchasedProductIds(input.userId);
  const candidateFilter = getPersonalCandidateFilter(profile, recentPurchasedIds);
  const [primaryCandidates, broadCandidates] = await Promise.all([
    fetchProducts(candidateFilter, CANDIDATE_POOL_LIMIT),
    fetchProducts(
      recentPurchasedIds.size
        ? {
            _id: {
              $nin: [...recentPurchasedIds]
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id)),
            },
          }
        : {},
      Math.max(limit * 4, 40),
    ),
  ]);
  const candidates = mergeProducts(primaryCandidates, broadCandidates);
  const inventoryByProductId = await getInventoryByProductId(candidates);
  const scoredProducts = candidates.map<ScoredProduct>((candidate) => {
    const feature = getProductFeature(candidate, inventoryByProductId);
    const userPreference = getProfileMatchScore(profile, feature);
    const popularity = getPopularityScore(feature);
    const business = getBusinessScore(feature);
    const score = calculatePersonalRecommendationScore({
      preferenceMatch: userPreference,
      popularity,
      business,
    });

    return {
      product: candidate,
      productItem: mapProductListItem(candidate, inventoryByProductId),
      score,
      reasonCodes: getPreferenceReasonCodes(profile, feature),
    };
  });

  const response = toRecommendationResponse(scoredProducts, limit, false);
  if (response.items.length) {
    return response;
  }

  return toRecommendationResponse(
    await getFallbackRecommendations({ limit, excludeProductIds: recentPurchasedIds }),
    limit,
    true,
  );
};

const getSimilarRecommendations = async (input: SimilarRecommendationInput) => {
  const limit = clampLimit(input.limit);
  return applyMerchandising(
    await getSimilarRecommendationsCore(input),
    'product_detail_similar',
    limit,
    new Set([input.productId]),
  );
};

const getCartRecommendations = async (input: CartRecommendationInput) => {
  const limit = clampLimit(input.limit);
  const userId = assertObjectId(input.userId, 'userId');
  const cart = await Cart.findOne({ user_id: userId })
    .select('product_list.productId')
    .lean<{ product_list?: Array<{ productId: Types.ObjectId }> } | null>();
  const excludedIds = new Set((cart?.product_list ?? []).map((item) => String(item.productId)));
  return applyMerchandising(
    await getCartRecommendationsCore(input),
    'cart',
    limit,
    excludedIds,
  );
};

const getPersonalRecommendations = async (input: PersonalRecommendationInput) =>
  applyMerchandising(
    await getPersonalRecommendationsCore(input),
    'home',
    clampLimit(input.limit),
  );

const registerRecommendationRequest = async (input: RegisterRecommendationRequestInput) => {
  if (!isRecommendationContext(input.context)) {
    throw new RecommendationServiceError('Invalid context', 400);
  }

  const userId = input.userId ? assertObjectId(input.userId, 'userId') : null;
  const sessionId = normalizeSessionId(input.sessionId);
  const sourceProductId = input.sourceProductId
    ? assertObjectId(input.sourceProductId, 'sourceProductId')
    : null;

  if (!userId && !sessionId) {
    return null;
  }

  const request = await RecommendationRequest.create({
    requestId: input.response.requestId,
    userId,
    sessionId,
    context: input.context,
    sourceProductId,
    algorithmVersion: input.response.algorithmVersion,
    fallbackUsed: input.response.fallbackUsed,
    items: input.response.items.map((item) => ({
      productId: assertObjectId(item.product._id, 'recommendedProductId'),
      score: item.score,
      rank: item.rank,
      reasonCodes: item.reasonCodes,
    })),
  });

  return {
    registered: true,
    requestId: request.requestId,
  };
};

const registerRecommendationRequestBestEffort = async (
  input: RegisterRecommendationRequestInput,
) => {
  try {
    return await registerRecommendationRequest(input);
  } catch (error) {
    console.warn('Failed to register recommendation request:', error);
    return null;
  }
};

const recordRecommendationEvent = async (input: RecommendationEventInput) => {
  if (!isRecommendationContext(input.context)) {
    throw new RecommendationServiceError('Invalid context', 400);
  }

  if (
    !isRecommendationEventType(input.eventType) ||
    (input.eventType !== 'impression' && input.eventType !== 'click')
  ) {
    throw new RecommendationServiceError('Invalid eventType', 400);
  }

  const requestId = input.requestId?.trim();
  if (!requestId) {
    throw new RecommendationServiceError('requestId is required', 400);
  }

  const recommendedProductId = assertObjectId(input.recommendedProductId, 'recommendedProductId');
  const sourceProductId = input.sourceProductId
    ? assertObjectId(input.sourceProductId, 'sourceProductId')
    : null;
  const userId = input.userId ? assertObjectId(input.userId, 'userId') : null;
  const sessionId = normalizeSessionId(input.sessionId);

  if (!userId && !sessionId) {
    throw new RecommendationServiceError('userId or sessionId is required', 400);
  }

  const issuedRequest = await RecommendationRequest.findOne({ requestId }).lean<{
    userId?: Types.ObjectId | null;
    sessionId?: string | null;
    context: RecommendationContext;
    sourceProductId?: Types.ObjectId | null;
    algorithmVersion: string;
    items: Array<{
      productId: Types.ObjectId;
      score: number;
      rank: number;
      reasonCodes: string[];
    }>;
  } | null>();

  if (!issuedRequest) {
    throw new RecommendationServiceError('Recommendation request not found or expired', 404);
  }

  if (issuedRequest.userId) {
    if (!userId || toIdString(issuedRequest.userId) !== toIdString(userId)) {
      throw new RecommendationServiceError('Recommendation request does not belong to this user', 403);
    }
  } else if (!sessionId || issuedRequest.sessionId !== sessionId) {
    throw new RecommendationServiceError('Recommendation request does not belong to this session', 403);
  }

  if (issuedRequest.context !== input.context) {
    throw new RecommendationServiceError('Recommendation context does not match request', 400);
  }

  if (toIdString(issuedRequest.sourceProductId) !== toIdString(sourceProductId)) {
    throw new RecommendationServiceError('Source product does not match request', 400);
  }

  const issuedItem = issuedRequest.items.find(
    (item) => toIdString(item.productId) === toIdString(recommendedProductId),
  );

  if (!issuedItem) {
    throw new RecommendationServiceError('Product was not issued in this recommendation request', 400);
  }

  const existingEvent = await RecommendationEvent.findOne({
    requestId,
    recommendedProductId,
    eventType: input.eventType,
  }).select('_id').lean<{ _id: Types.ObjectId } | null>();

  if (existingEvent) {
    return {
      recorded: false,
      eventId: existingEvent._id.toString(),
    };
  }

  let event;
  try {
    event = await RecommendationEvent.create({
      userId,
      sessionId,
      context: issuedRequest.context,
      sourceProductId: issuedRequest.sourceProductId ?? null,
      recommendedProductId,
      algorithmVersion: issuedRequest.algorithmVersion,
      score: issuedItem.score,
      rank: issuedItem.rank,
      reasonCodes: issuedItem.reasonCodes.slice(0, 10),
      eventType: input.eventType,
      requestId,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const duplicateEvent = await RecommendationEvent.findOne({
      requestId,
      recommendedProductId,
      eventType: input.eventType,
    }).select('_id').lean<{ _id: Types.ObjectId } | null>();

    return {
      recorded: false,
      eventId: duplicateEvent?._id.toString(),
    };
  }

  if (input.eventType === 'click') {
    await interactionService.recordInteractionBestEffort(
      {
        userId: userId?.toString(),
        sessionId,
        productId: recommendedProductId.toString(),
        actionType: 'recommendation_click',
        source: 'recommendation',
        metadata: {
          recommendationRequestId: requestId,
          recommendationContext: issuedRequest.context,
          recommendationRank: issuedItem.rank,
          recommendationScore: issuedItem.score,
          algorithmVersion: issuedRequest.algorithmVersion,
        },
      },
      'Failed to record recommendation click interaction',
    );
  }

  return {
    recorded: true,
    eventId: event._id.toString(),
  };
};

const findSourceRecommendationEvent = async ({
  userId,
  sessionId,
  requestId,
  recommendedProductId,
  orderId,
}: {
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  requestId: string;
  recommendedProductId: Types.ObjectId;
  orderId?: Types.ObjectId | null;
}) => {
  const filter = {
    ...(userId && sessionId
      ? { $or: [{ userId }, { sessionId }] }
      : userId
        ? { userId }
        : sessionId
          ? { sessionId }
          : {}),
    requestId,
    recommendedProductId,
  };

  const orderCreatedEvent = orderId
    ? await RecommendationEvent.findOne({
        ...filter,
        orderId,
        eventType: 'order_created',
      }).sort({ createdAt: -1 })
    : null;

  return (
    orderCreatedEvent ??
    await RecommendationEvent.findOne({ ...filter, eventType: 'add_to_cart' }).sort({ createdAt: -1 }) ??
    await RecommendationEvent.findOne({ ...filter, eventType: 'click' }).sort({ createdAt: -1 }) ??
    await RecommendationEvent.findOne({ ...filter, eventType: 'impression' }).sort({ createdAt: -1 })
  );
};

const recordRecommendationConversionEvent = async (input: RecommendationConversionEventInput) => {
  const lifecycleEventTypes = [
    'order_created',
    'payment_completed',
    'order_cancelled',
    'order_returned',
  ] as const;
  const isLifecycleEvent = lifecycleEventTypes.includes(
    input.eventType as (typeof lifecycleEventTypes)[number],
  );

  if (input.eventType !== 'add_to_cart' && !isLifecycleEvent) {
    throw new RecommendationServiceError('Invalid conversion eventType', 400);
  }

  const requestId = input.requestId?.trim();
  if (!requestId) {
    return null;
  }

  const recommendedProductId = assertObjectId(input.recommendedProductId, 'recommendedProductId');
  const userId = input.userId ? assertObjectId(input.userId, 'userId') : null;
  const sessionId = normalizeSessionId(input.sessionId);
  const orderId = input.orderId ? assertObjectId(input.orderId, 'orderId') : null;
  if (isLifecycleEvent && !orderId) {
    throw new RecommendationServiceError('orderId is required for lifecycle events', 400);
  }

  const sourceEvent = await findSourceRecommendationEvent({
    userId,
    sessionId,
    requestId,
    recommendedProductId,
    orderId,
  });

  if (!sourceEvent) {
    return null;
  }

  const eventFilter = isLifecycleEvent
    ? { orderId, recommendedProductId, eventType: input.eventType }
    : { requestId, recommendedProductId, eventType: input.eventType };
  const existingEvent = await RecommendationEvent.findOne(eventFilter)
    .select('_id')
    .lean<{ _id: Types.ObjectId } | null>();

  if (existingEvent) {
    if (isLifecycleEvent && input.reversesPayment) {
      await RecommendationEvent.updateOne(
        { _id: existingEvent._id },
        {
          $set: {
            reversesPayment: true,
            orderStatus: input.orderStatus?.trim() || null,
            orderPaymentStatus: input.orderPaymentStatus?.trim() || null,
          },
        },
      );
    }

    return {
      recorded: false,
      eventId: existingEvent._id.toString(),
    };
  }

  let event;
  try {
    event = await RecommendationEvent.create({
      userId,
      sessionId: sourceEvent.sessionId ?? null,
      context: sourceEvent.context,
      sourceProductId: sourceEvent.sourceProductId ?? null,
      recommendedProductId,
      algorithmVersion: sourceEvent.algorithmVersion || RECOMMENDATION_ALGORITHM_VERSION,
      score: sourceEvent.score ?? 0,
      rank: sourceEvent.rank ?? 0,
      reasonCodes: sourceEvent.reasonCodes ?? [],
      eventType: input.eventType,
      requestId,
      ...(isLifecycleEvent
        ? {
            schemaVersion: 2,
            orderId,
            orderCode: input.orderCode?.trim() || null,
            orderStatus: input.orderStatus?.trim() || null,
            orderPaymentStatus: input.orderPaymentStatus?.trim() || null,
            quantity: Number.isInteger(input.quantity) && Number(input.quantity) > 0
              ? Number(input.quantity)
              : 1,
            attributedAmount: typeof input.attributedAmount === 'number'
              && Number.isFinite(input.attributedAmount)
              && input.attributedAmount >= 0
              ? Number(input.attributedAmount)
              : 0,
            reversesPayment: Boolean(input.reversesPayment),
          }
        : {}),
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const duplicateEvent = await RecommendationEvent.findOne(eventFilter)
      .select('_id')
      .lean<{ _id: Types.ObjectId } | null>();

    return {
      recorded: false,
      eventId: duplicateEvent?._id.toString(),
    };
  }

  return {
    recorded: true,
    eventId: event._id.toString(),
  };
};

const recordRecommendationConversionEventBestEffort = async (
  input: RecommendationConversionEventInput,
  context = 'Failed to record recommendation conversion event',
) => {
  try {
    return await recordRecommendationConversionEvent(input);
  } catch (error) {
    console.warn(`${context}:`, error);
    return null;
  }
};

export const recommendationService = {
  getCartRecommendations,
  getPersonalRecommendations,
  getSimilarRecommendations,
  registerRecommendationRequest,
  registerRecommendationRequestBestEffort,
  recordRecommendationConversionEvent,
  recordRecommendationConversionEventBestEffort,
  recordRecommendationEvent,
};
