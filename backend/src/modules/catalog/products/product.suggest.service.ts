import { Brand, Category, Product } from '../../../database/models';
import { normalizeCatalogImageUrl } from '../catalog-image';
import { tokenize, toAccentInsensitiveRegex, toTokenRegexes } from './search.util';
import { inferGenderFromTokens, expandMaterialTokens, expandMaterialTokenGroups, buildSearchKeywordSuggestions } from './search-keywords';

export type SuggestProduct = {
  _id: string;
  name: string;
  image: string;
  price: number;
  discount: number;
  finalPrice: number;
  brandName?: string;
};

export type SuggestCategory = {
  _id: string;
  name: string;
  gender: string;
};

export type SuggestResponse = {
  products: SuggestProduct[];
  categories: SuggestCategory[];
  keywords: string[];
};

const SUGGEST_CACHE_TTL = 60_000;
const suggestCache = new Map<string, { data: SuggestResponse; expires: number }>();

const getFinalPrice = (price: number, discount: number) => Math.round(price * (1 - discount / 100));

const getCachedSuggest = (key: string): SuggestResponse | null => {
  const cached = suggestCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  return null;
};

const setCachedSuggest = (key: string, data: SuggestResponse) => {
  suggestCache.set(key, { data, expires: Date.now() + SUGGEST_CACHE_TTL });
};

export const suggest = async (keyword: string, limit: number = 5): Promise<SuggestResponse> => {
  const trimmed = keyword.trim();
  const cacheKey = `${trimmed}:${limit}`;
  const cached = getCachedSuggest(cacheKey);
  if (cached) return cached;

  const tokens = tokenize(trimmed);
  if (!tokens.length) {
    return { products: [], categories: [], keywords: [] };
  }

  const expandedTokens = expandMaterialTokens(tokens);
  const tokenGroups = expandMaterialTokenGroups(tokens);
  const tokenRegexes = toTokenRegexes(expandedTokens);
  const gender = inferGenderFromTokens(tokens);

  const [brands, categories] = await Promise.all([
    Brand.find({ $or: tokenRegexes.map((regex) => ({ name: regex })), isActive: true }).select('_id name').lean(),
    Category.find({
      $or: tokenRegexes.map((regex) => ({ name: regex })),
      isActive: true,
      ...(gender ? { gender } : {}),
    }).select('_id name gender').limit(3).lean(),
  ]);

  const brandIds = brands.map((b) => b._id);
  const categoryIds = categories.map((c) => c._id);

  const andConditions = tokenGroups.map((group) => {
    const orConditions: Record<string, unknown>[] = group.flatMap((token) => {
      const regex = toAccentInsensitiveRegex(token);
      return [
        { name: regex },
        { description: regex },
        { materialNormalized: regex },
      ];
    });
    if (brandIds.length) orConditions.push({ brand_id: { $in: brandIds } });
    if (categoryIds.length) orConditions.push({ category_id: { $in: categoryIds } });
    return { $or: orConditions };
  });

  const filter: Record<string, unknown> = {
    isActive: true,
    variant: { $elemMatch: { isActive: true } },
  };
  if (gender) {
    const genderCategoryIds = await Category.find({ gender, isActive: true }).select('_id').lean();
    filter.category_id = { $in: genderCategoryIds.map((c) => c._id) };
  }
  if (andConditions.length) filter.$and = andConditions;

  const products = await Product.find(filter)
    .populate('brand_id', 'name')
    .select('_id name product_image variant.price variant.discount brand_id')
    .sort({ sold_quantity: -1 })
    .limit(limit)
    .lean();

  const serializedProducts: SuggestProduct[] = products.map((product) => {
    const variant = product.variant?.[0];
    const price = variant?.price ?? 0;
    const discount = variant?.discount ?? 0;
    const brand = product.brand_id as unknown as { name?: string } | null;
    return {
      _id: product._id.toString(),
      name: product.name,
      image: normalizeCatalogImageUrl(variant?.colors?.[0]?.image || product.product_image) ?? product.product_image,
      price,
      discount,
      finalPrice: getFinalPrice(price, discount),
      brandName: brand?.name,
    };
  });

  const serializedCategories: SuggestCategory[] = categories.map((category) => ({
    _id: category._id.toString(),
    name: category.name,
    gender: category.gender,
  }));

  const keywords = buildSearchKeywordSuggestions({
    query: trimmed,
    productNames: serializedProducts.map((product) => product.name),
    categoryNames: serializedCategories.map((category) => category.name),
    limit: 8,
  });
  const result: SuggestResponse = {
    products: serializedProducts,
    categories: serializedCategories,
    keywords,
  };

  setCachedSuggest(cacheKey, result);
  return result;
};
