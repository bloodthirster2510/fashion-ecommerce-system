import { SortOrder, Types } from 'mongoose';
import {
  Brand,
  Cart,
  Category,
  Coupon,
  Favorite,
  Inventory,
  InventoryImport,
  InventoryReservation,
  Order,
  Product,
  ProductVisualIndex,
  type ICategory,
  type ICategoryFitType,
  type IInventory,
  type IMeasurementField,
  type IProductVariant,
} from '../../../database/models';
import { CatalogImageUrlError, normalizeCatalogImageUrl } from '../catalog-image';
import type {
  CreateProductInput,
  ProductCategoryBreadcrumbItem,
  ProductDetailColor,
  ProductDetailInventoryItem,
  ProductDetailResponse,
  ProductDetailVariant,
  ProductGenderFilter,
  ProductListQueryInput,
  ProductListResponse,
  ProductManagementItem,
  ProductSortOption,
  ProductVariantInput,
  UpdateProductInput,
} from './product.types';
import {
  tokenize,
  toAccentInsensitiveRegex,
  toExactPhraseRegex,
  toTokenRegexes,
} from './search.util';
import {
  inferGenderFromTokens,
  expandMaterialTokens,
  expandMaterialTokenGroups,
  isMaterialToken,
} from './search-keywords';

export class ProductServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ProductServiceError';
  }
}

const assertValidObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ProductServiceError(`Invalid ${fieldName}`, 400);
  }
};

const normalizeProductImageUrl = (imageUrl: string) => {
  try {
    return normalizeCatalogImageUrl(imageUrl);
  } catch (error) {
    if (error instanceof CatalogImageUrlError) {
      throw new ProductServiceError(error.message, 400);
    }

    throw error;
  }
};

const NEW_PRODUCT_DAYS = 30;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const assertBrandExists = async (brandId: string) => {
  assertValidObjectId(brandId, 'brand id');

  const brand = await Brand.findById(brandId);

  if (!brand) {
    throw new ProductServiceError('Brand not found', 404);
  }

  if (brand.isActive === false) {
    throw new ProductServiceError('Brand is inactive', 400);
  }
};

const assertCategoryExists = async (categoryId: string) => {
  assertValidObjectId(categoryId, 'category id');

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ProductServiceError('Category not found', 404);
  }

  if (category.isActive === false) {
    throw new ProductServiceError('Category is inactive', 400);
  }
};

const normalizeVariants = (variants?: ProductVariantInput[]) => {
  if (!variants) {
    return [];
  }

  return variants.map((variant) => {
    const variantId = variant._id?.trim();

    if (variantId && !Types.ObjectId.isValid(variantId)) {
      throw new ProductServiceError('Invalid variant id', 400);
    }

    if (!variant.fitTypeId || !variant.fitTypeId.trim()) {
      throw new ProductServiceError('Variant fitTypeId is required', 400);
    }

    return {
      ...(variantId ? { _id: new Types.ObjectId(variantId) } : {}),
      fitTypeId: new Types.ObjectId(variant.fitTypeId.trim()),
      price: variant.price,
      discount: variant.discount,
      sizeMeasurements: variant.sizeMeasurements.map((sizeMeasurement) => ({
        size: sizeMeasurement.size.trim(),
        measurements: [],
      })),
      colors: variant.colors.map((color) => ({
        ...(color._id?.trim()
          ? { _id: new Types.ObjectId(color._id.trim()) }
          : {}),
        color: color.color.trim(),
        colorCode: color.colorCode?.trim(),
        image: normalizeProductImageUrl(color.image),
      })),
      isActive: variant.isActive ?? true,
    };
  });
};

const assertUniqueFitTypesInPayload = (variants?: ProductVariantInput[]) => {
  if (!variants?.length) {
    return;
  }

  const normalizedFitTypeIds = variants.map((variant) => variant.fitTypeId.trim().toLowerCase());
  const uniqueFitTypeIds = new Set(normalizedFitTypeIds);

  if (uniqueFitTypeIds.size !== normalizedFitTypeIds.length) {
    throw new ProductServiceError('Duplicate fitTypeId in product variants', 400);
  }
};

const assertVariantSizesAndColors = (variants?: ProductVariantInput[]) => {
  if (!variants?.length) {
    return;
  }

  for (const variant of variants) {
    const normalizedSizes = variant.sizeMeasurements.map((sizeMeasurement) => sizeMeasurement.size.trim().toLowerCase());
    if (new Set(normalizedSizes).size !== normalizedSizes.length) {
      throw new ProductServiceError('Duplicate size in product variant', 400);
    }

    const normalizedColors = variant.colors.map((color) => color.color.trim().toLowerCase());
    if (new Set(normalizedColors).size !== normalizedColors.length) {
      throw new ProductServiceError('Duplicate color in product variant', 400);
    }
  }
};

const assertVariantValuesValid = (variants?: ProductVariantInput[]) => {
  if (!variants?.length) {
    return;
  }

  for (const variant of variants) {
    if (variant._id?.trim() && !Types.ObjectId.isValid(variant._id.trim())) {
      throw new ProductServiceError('Invalid variant id', 400);
    }

    if (!variant.fitTypeId?.trim()) {
      throw new ProductServiceError('Variant fitTypeId is required', 400);
    }

    if (variant.price <= 0) {
      throw new ProductServiceError('Variant price must be greater than 0', 400);
    }

    if (variant.discount < 0 || variant.discount > 100) {
      throw new ProductServiceError('Variant discount must be between 0 and 100', 400);
    }

    if (!variant.sizeMeasurements?.length) {
      throw new ProductServiceError('Variant must include at least one size', 400);
    }

    if (!variant.colors?.length) {
      throw new ProductServiceError('Variant must include at least one color option', 400);
    }

    for (const color of variant.colors) {
      if (color._id?.trim() && !Types.ObjectId.isValid(color._id.trim())) {
        throw new ProductServiceError('Invalid color variant id', 400);
      }
    }
  }
};

const assertVariantPayload = (variants?: ProductVariantInput[]) => {
  assertUniqueFitTypesInPayload(variants);
  assertVariantSizesAndColors(variants);
  assertVariantValuesValid(variants);
};

const resolveCategoryFitTypeTemplateSource = async (categoryId: string): Promise<ICategory> => {
  assertValidObjectId(categoryId, 'category id');

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ProductServiceError('Category not found', 404);
  }

  if (category.isFitTypeTemplateSource) {
    return category;
  }

  if (category.fitTypeTemplateSourceId) {
    const sourceCategory = await Category.findById(category.fitTypeTemplateSourceId);
    if (sourceCategory) {
      return sourceCategory;
    }
  }

  if (category.sizeTemplateSourceId) {
    const sourceCategory = await Category.findById(category.sizeTemplateSourceId);
    if (sourceCategory) {
      return sourceCategory;
    }
  }

  if (category.fitTypes?.length) {
    return category;
  }

  if (category.parent_id) {
    const parentCategory = await Category.findById(category.parent_id);
    if (parentCategory) {
      return parentCategory;
    }
  }

  return category;
};

const assertVariantTemplateMatchesCategory = async (
  categoryId: string,
  variants?: ProductVariantInput[],
) => {
  if (!variants?.length) {
    return;
  }

  const templateCategory = await resolveCategoryFitTypeTemplateSource(categoryId);
  const allowedFitTypeIds = new Set(
    (templateCategory.fitTypes ?? []).map((fitType) => fitType._id.toString()),
  );

  for (const variant of variants) {
    if (!allowedFitTypeIds.has(variant.fitTypeId.trim())) {
      throw new ProductServiceError('Variant fitTypeId is not valid for this category', 400);
    }
  }
};

type PopulatedBrand = {
  _id: Types.ObjectId;
  name: string;
  image?: string;
};

type PopulatedCategory = {
  _id: Types.ObjectId;
  name: string;
  gender?: ProductGenderFilter;
  parent_id?: Types.ObjectId | null;
  level?: number;
  image?: string;
  isSizeTemplateSource?: boolean;
  sizeTemplateSourceId?: Types.ObjectId | null;
  sizeGuideImage?: string;
  isFitTypeTemplateSource?: boolean;
  fitTypeTemplateSourceId?: Types.ObjectId | null;
  sizes?: string[];
  measurementFields?: IMeasurementField[];
  fitTypes?: ICategoryFitType[];
};

type ProductListDocument = {
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
  'productId' | 'variantId' | 'colorVariantId' | 'size' | 'sku' | 'quantity' | 'reservedQuantity' | 'availableQuantity'
>;

type InventoryQuantityDocument = Pick<
  IInventory,
  'quantity' | 'reservedQuantity' | 'availableQuantity'
>;

type ProductManagementDocument = Omit<ProductListDocument, 'brand_id' | 'category_id'> & {
  brand: PopulatedBrand | null;
  category: PopulatedCategory | null;
  templateCategory: PopulatedCategory | null;
  inventoryItems: InventoryStockDocument[];
};

type ProductPermanentDeleteCheckInput = {
  productId: Types.ObjectId;
  categoryId?: string;
  soldQuantity: number;
  reviewCount: number;
  inventoryItems?: InventoryQuantityDocument[];
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const toCaseInsensitiveRegexList = (values?: string[]) => {
  return values?.map((value) => new RegExp(`^${escapeRegex(value.trim())}$`, 'i'));
};

const toObjectIdList = (values?: string[]) => {
  if (!values?.length) {
    return [];
  }

  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new ProductServiceError('Invalid fitTypeId', 400);
      }
      return new Types.ObjectId(value);
    });
};

const clampPagination = (query: ProductListQueryInput) => {
  const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit };
};

const getNewProductCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_PRODUCT_DAYS);
  return cutoff;
};

const getFinalPrice = (price: number, discount: number) => {
  if (discount <= 0) {
    return price;
  }

  return Math.round(price * (1 - discount / 100));
};

const getFinalPriceAggregationExpression = (variantPath: string) => ({
  $round: [
    {
      $multiply: [
        `${variantPath}.price`,
        { $subtract: [1, { $divide: [`${variantPath}.discount`, 100] }] },
      ],
    },
    0,
  ],
});

const hasVariantSize = (variant: IProductVariant, selectedSizes?: string[]) => {
  const normalizedSizes = selectedSizes?.map((size) => size.trim().toLowerCase());

  return variant.sizeMeasurements.some((sizeMeasurement) => {
    return !normalizedSizes?.length || normalizedSizes.includes(sizeMeasurement.size.toLowerCase());
  });
};

const matchesInventorySize = (inventory: InventoryStockDocument, selectedSizes?: string[]) => {
  if (!selectedSizes?.length) {
    return true;
  }

  const inventorySize = inventory.size.trim().toLowerCase();
  return selectedSizes.some((size) => size.trim().toLowerCase() === inventorySize);
};

const getAvailableQuantityForVariant = (
  variant: IProductVariant,
  inventoryItems: InventoryStockDocument[],
  selectedSizes?: string[],
) => {
  const variantId = toIdString(variant._id);

  return inventoryItems
    .filter((inventory) => {
      return (
        toIdString(inventory.variantId) === variantId &&
        inventory.availableQuantity > 0 &&
        matchesInventorySize(inventory, selectedSizes)
      );
    })
    .reduce((sum, inventory) => sum + inventory.availableQuantity, 0);
};

const hasAvailableInventoryForVariant = (
  variant: IProductVariant,
  inventoryItems?: InventoryStockDocument[],
  selectedSizes?: string[],
) => {
  if (!inventoryItems) {
    return true;
  }

  return getAvailableQuantityForVariant(variant, inventoryItems, selectedSizes) > 0;
};

const matchesTextList = (value: string, selectedValues?: string[]) => {
  if (!selectedValues?.length) {
    return true;
  }

  const normalizedValue = value.trim().toLowerCase();
  return selectedValues.some((selectedValue) => selectedValue.trim().toLowerCase() === normalizedValue);
};

const matchesObjectIdList = (value: Types.ObjectId, selectedValues?: string[]) => {
  if (!selectedValues?.length) {
    return true;
  }

  const normalizedValue = value.toString();
  return selectedValues.some((selectedValue) => selectedValue.trim() === normalizedValue);
};

const matchesVariantQuery = (
  variant: IProductVariant,
  query: ProductListQueryInput,
) => {
  if (!variant.isActive || !hasVariantSize(variant, query.size)) {
    return false;
  }

  if (!matchesTextList(variant.colors?.[0]?.color ?? '', query.color) && query.color?.length) {
    return variant.colors.some((color) => matchesTextList(color.color, query.color));
  }

  if (!matchesObjectIdList(variant.fitTypeId, query.fitType)) {
    return false;
  }

  const finalPrice = getFinalPrice(variant.price, variant.discount);

  if (query.minPrice !== undefined && finalPrice < query.minPrice) {
    return false;
  }

  if (query.maxPrice !== undefined && finalPrice > query.maxPrice) {
    return false;
  }

  if (query.isSale && variant.discount <= 0) {
    return false;
  }

  return true;
};

const selectDisplayVariant = (
  variants: IProductVariant[],
  query: ProductListQueryInput,
  inventoryItems?: InventoryStockDocument[],
) => {
  const queryMatchingVariants = variants.filter((variant) => matchesVariantQuery(variant, query));
  const availableMatchingVariants = queryMatchingVariants.filter((variant) =>
    hasAvailableInventoryForVariant(variant, inventoryItems, query.size)
  );
  const displayCandidates = availableMatchingVariants.length
    ? availableMatchingVariants
    : queryMatchingVariants;

  if (displayCandidates.length && isPriceSort(query.sort)) {
    const direction = query.sort === 'price_asc' ? 1 : -1;
    return [...displayCandidates].sort((left, right) => {
      return direction * (
        getFinalPrice(left.price, left.discount) - getFinalPrice(right.price, right.discount)
      );
    })[0];
  }

  return (
    displayCandidates[0] ??
    variants.find((variant) =>
      variant.isActive &&
      hasVariantSize(variant) &&
      hasAvailableInventoryForVariant(variant, inventoryItems)
    ) ??
    variants[0]
  );
};

const isNewProduct = (createdAt: Date) => {
  return createdAt >= getNewProductCutoff();
};

const getSortOption = (sort?: ProductSortOption): Record<string, SortOrder> => {
  switch (sort) {
    case 'name_asc':
      return { name: 1 };
    case 'name_desc':
      return { name: -1 };
    case 'best_seller':
      return { sold_quantity: -1, createdAt: -1 };
    case 'rating_desc':
      return { averageRating: -1, reviewCount: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
};

const isPriceSort = (sort?: ProductSortOption): sort is 'price_asc' | 'price_desc' =>
  sort === 'price_asc' || sort === 'price_desc';

const buildVariantAggregationConditions = (query: ProductListQueryInput) => {
  const conditions: Record<string, unknown>[] = [
    { $eq: ['$$variant.isActive', true] },
  ];
  const selectedSizes = query.size
    ?.map((size) => size.trim().toLowerCase())
    .filter(Boolean);
  const selectedColors = query.color
    ?.map((color) => color.trim().toLowerCase())
    .filter(Boolean);

  if (selectedSizes?.length) {
    conditions.push({
      $gt: [
        {
          $size: {
            $filter: {
              input: { $ifNull: ['$$variant.sizeMeasurements', []] },
              as: 'sizeMeasurement',
              cond: {
                $in: [{ $toLower: '$$sizeMeasurement.size' }, selectedSizes],
              },
            },
          },
        },
        0,
      ],
    });
  }

  if (selectedColors?.length) {
    conditions.push({
      $gt: [
        {
          $size: {
            $filter: {
              input: { $ifNull: ['$$variant.colors', []] },
              as: 'color',
              cond: {
                $in: [{ $toLower: '$$color.color' }, selectedColors],
              },
            },
          },
        },
        0,
      ],
    });
  }

  if (query.fitType?.length) {
    conditions.push({
      $in: ['$$variant.fitTypeId', toObjectIdList(query.fitType)],
    });
  }

  const finalPriceExpression = getFinalPriceAggregationExpression('$$variant');
  if (query.minPrice !== undefined) {
    conditions.push({ $gte: [finalPriceExpression, query.minPrice] });
  }
  if (query.maxPrice !== undefined) {
    conditions.push({ $lte: [finalPriceExpression, query.maxPrice] });
  }

  if (query.isSale) {
    conditions.push({ $gt: ['$$variant.discount', 0] });
  }

  return conditions;
};

const buildMatchingVariantExpression = (query: ProductListQueryInput) => ({
  $gt: [
    {
      $size: {
        $filter: {
          input: { $ifNull: ['$variant', []] },
          as: 'variant',
          cond: { $and: buildVariantAggregationConditions(query) },
        },
      },
    },
    0,
  ],
});

const getPriceSortedProductIds = async (
  filter: ProductListFilter,
  query: ProductListQueryInput,
  sort: 'price_asc' | 'price_desc',
  page: number,
  limit: number,
) => {
  const direction = sort === 'price_asc' ? 1 : -1;
  const priceOperator = sort === 'price_asc' ? '$min' : '$max';

  return Product.aggregate<{ _id: Types.ObjectId }>([
    { $match: filter },
    {
      $addFields: {
        __catalogFinalPrice: {
          [priceOperator]: {
            $map: {
              input: {
                $filter: {
                  input: '$variant',
                  as: 'variant',
                  cond: { $and: buildVariantAggregationConditions(query) },
                },
              },
              as: 'variant',
              in: getFinalPriceAggregationExpression('$$variant'),
            },
          },
        },
      },
    },
    { $sort: { __catalogFinalPrice: direction, createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);
};

const buildVariantFilter = (query: ProductListQueryInput) => {
  const selectedSizes = toCaseInsensitiveRegexList(query.size);
  const sizeMeasurementFilter: Record<string, unknown> = {};

  if (selectedSizes?.length) {
    sizeMeasurementFilter.size = { $in: selectedSizes };
  }

  const variantFilter: Record<string, unknown> = {
    isActive: true,
  };

  if (selectedSizes?.length) {
    variantFilter.sizeMeasurements = { $elemMatch: sizeMeasurementFilter };
  }

  const selectedColors = toCaseInsensitiveRegexList(query.color);
  if (selectedColors?.length) {
    variantFilter['colors.color'] = { $in: selectedColors };
  }

  if (query.fitType?.length) {
    variantFilter.fitTypeId = { $in: toObjectIdList(query.fitType) };
  }

  if (query.isSale) {
    variantFilter.discount = { $gt: 0 };
  }

  return variantFilter;
};

const getDescendantCategoryIds = async (categoryId: string, gender?: ProductGenderFilter) => {
  assertValidObjectId(categoryId, 'category id');

  const rootCategory = await Category.findById(categoryId).select('_id gender isActive').lean();

  if (!rootCategory) {
    return [];
  }

  if (!rootCategory.isActive || (gender && rootCategory.gender !== gender)) {
    return [];
  }

  const categoryIds = [rootCategory._id];
  let parentIds = [rootCategory._id];

  while (parentIds.length > 0) {
    const childCategories = await Category.find({
      parent_id: { $in: parentIds },
      isActive: true,
      ...(gender ? { gender } : {}),
    })
      .select('_id')
      .lean();

    parentIds = childCategories.map((category) => category._id);
    categoryIds.push(...parentIds);
  }

  return categoryIds;
};

const getCategoryIdsByGender = async (gender: ProductGenderFilter) => {
  const categories = await Category.find({ gender, isActive: true }).select('_id').lean();
  return categories.map((category) => category._id);
};

const resolveCategoryFilter = async (query: ProductListQueryInput) => {
  if (query.categoryId?.length) {
    const categoryIdGroups = await Promise.all(
      query.categoryId.map((categoryId) => getDescendantCategoryIds(categoryId, query.gender)),
    );
    const categoryIdsByString = new Map<string, Types.ObjectId>();

    categoryIdGroups.flat().forEach((categoryId) => {
      categoryIdsByString.set(categoryId.toString(), categoryId);
    });

    return Array.from(categoryIdsByString.values());
  }

  if (query.gender) {
    return getCategoryIdsByGender(query.gender);
  }

  return undefined;
};

const resolveActiveBrandFilter = async (brandIds?: string[]) => {
  const filter: Record<string, unknown> = { isActive: true };

  if (brandIds?.length) {
    brandIds.forEach((brandId) => assertValidObjectId(brandId, 'brand id'));
    filter._id = { $in: brandIds.map((brandId) => new Types.ObjectId(brandId)) };
  }

  const brands = await Brand.find(filter)
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>();

  return brands.map((brand) => brand._id);
};

const toMaterialDescriptionRegex = (material: string) => {
  if (material.toLowerCase() !== 'da') {
    return toExactPhraseRegex(material);
  }

  const contextPattern = [
    'chất liệu',
    'làm từ',
    'thành phần',
  ]
    .map((context) => toAccentInsensitiveRegex(context).source)
    .join('|');

  return new RegExp(
    `(?:${contextPattern})[^.!?\r\n]{0,40}${toExactPhraseRegex(material).source}`,
    'i',
  );
};

const buildKeywordConditions = async (keyword?: string): Promise<Record<string, unknown>[] | undefined> => {
  const trimmedKeyword = keyword?.trim();

  if (!trimmedKeyword) {
    return undefined;
  }

  const tokens = tokenize(trimmedKeyword);
  if (!tokens.length) {
    return undefined;
  }

  const expandedTokens = expandMaterialTokens(tokens);
  const tokenGroups = expandMaterialTokenGroups(tokens);
  const tokenRegexes = toTokenRegexes(expandedTokens);

  const [brands, categories] = await Promise.all([
    Brand.find({ $or: tokenRegexes.map((regex) => ({ name: regex })), isActive: true })
      .select('_id name')
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
    Category.find({ $or: tokenRegexes.map((regex) => ({ name: regex })), isActive: true })
      .select('_id name')
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
  ]);

  return tokenGroups.map((group) => {
    const isMaterialGroup = group.some(isMaterialToken);
    const toGroupRegex = isMaterialGroup ? toExactPhraseRegex : toAccentInsensitiveRegex;
    const groupRegexes = group.map(toGroupRegex);
    const orConditions: Record<string, unknown>[] = group.flatMap((token) => {
      const regex = toGroupRegex(token);
      return [
        { name: regex },
        { description: isMaterialGroup ? toMaterialDescriptionRegex(token) : regex },
        { materialNormalized: regex },
      ];
    });
    const brandIds = brands
      .filter((brand) => groupRegexes.some((regex) => regex.test(brand.name)))
      .map((brand) => brand._id);
    const categoryIds = categories
      .filter((category) => groupRegexes.some((regex) => regex.test(category.name)))
      .map((category) => category._id);

    if (brandIds.length) orConditions.push({ brand_id: { $in: brandIds } });
    if (categoryIds.length) orConditions.push({ category_id: { $in: categoryIds } });
    return { $or: orConditions };
  });
};

type ProductListFilter = Record<string, unknown>;

const buildProductListFilter = async (query: ProductListQueryInput): Promise<ProductListFilter> => {
  const filter: ProductListFilter = {
    isActive: true,
    variant: { $elemMatch: buildVariantFilter(query) },
  };

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.$expr = buildMatchingVariantExpression(query);
  }

  let effectiveGender = query.gender;
  if (query.keyword && !effectiveGender) {
    const tokens = tokenize(query.keyword);
    const inferred = inferGenderFromTokens(tokens);
    if (inferred) effectiveGender = inferred;
  }

  const categoryIds = await resolveCategoryFilter({ ...query, gender: effectiveGender });
  if (categoryIds) {
    filter.category_id = { $in: categoryIds };
  }

  filter.brand_id = { $in: await resolveActiveBrandFilter(query.brandId) };

  if (query.isNew) {
    filter.createdAt = { $gte: getNewProductCutoff() };
  }

  const keywordConditions = await buildKeywordConditions(query.keyword);
  if (keywordConditions?.length) {
    filter.$and = keywordConditions;
  }

  return filter;
};

const toIdString = (value: Types.ObjectId | string | { toString(): string } | null | undefined) => {
  return value?.toString() ?? '';
};

const getRelationId = (relation: Types.ObjectId | { _id: Types.ObjectId } | null | undefined) => {
  if (!relation) {
    return '';
  }

  if (relation instanceof Types.ObjectId) {
    return toIdString(relation);
  }

  return toIdString(relation._id);
};

const isPopulatedBrand = (relation: ProductListDocument['brand_id']): relation is PopulatedBrand => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);
};

const isPopulatedCategory = (
  relation: ProductListDocument['category_id'],
): relation is PopulatedCategory => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);
};

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

const getInventoryLookupKey = (
  variantId: Types.ObjectId | string | { toString(): string },
  colorVariantId: Types.ObjectId | string | { toString(): string },
  size: string,
) => {
  return `${toIdString(variantId)}:${toIdString(colorVariantId)}:${size.trim().toLowerCase()}`;
};

const groupInventoryByVariantColorAndSize = (
  inventoryItems: InventoryStockDocument[],
) => {
  return new Map(
    inventoryItems.map((inventory) => [
      getInventoryLookupKey(
        inventory.variantId,
        inventory.colorVariantId,
        inventory.size,
      ),
      inventory,
    ]),
  );
};

const getInventoryOptionKey = (
  variantId: Types.ObjectId | string | { toString(): string },
  colorVariantId: Types.ObjectId | string | { toString(): string },
) => `${toIdString(variantId)}:${toIdString(colorVariantId)}`;

const getSizeSetKey = (sizes: Iterable<string>) => {
  return [...sizes].map((size) => size.trim().toLowerCase()).sort().join('|');
};

const repairInventoryReferencesForProduct = async (
  productId: Types.ObjectId,
  variants: IProductVariant[],
  inventoryItems: InventoryStockDocument[],
) => {
  if (!inventoryItems.length || !variants.length) {
    return;
  }

  const currentOptions = variants.flatMap((variant) =>
    variant.colors.map((color) => ({
      variantId: toIdString(variant._id),
      colorVariantId: toIdString(color._id),
      sizeSetKey: getSizeSetKey(variant.sizeMeasurements.map((item) => item.size)),
    })),
  );
  const currentOptionKeys = new Set(
    currentOptions.map((option) => getInventoryOptionKey(option.variantId, option.colorVariantId)),
  );
  const occupiedCurrentKeys = new Set<string>();
  const orphanGroups = new Map<string, InventoryStockDocument[]>();

  inventoryItems.forEach((inventory) => {
    const optionKey = getInventoryOptionKey(inventory.variantId, inventory.colorVariantId);

    if (currentOptionKeys.has(optionKey)) {
      occupiedCurrentKeys.add(optionKey);
      return;
    }

    const group = orphanGroups.get(optionKey) ?? [];
    group.push(inventory);
    orphanGroups.set(optionKey, group);
  });

  if (!orphanGroups.size) {
    return;
  }

  const usedTargetKeys = new Set<string>();
  const replacements: Array<{
    fromVariantId: Types.ObjectId;
    fromColorVariantId: Types.ObjectId;
    toVariantId: Types.ObjectId;
    toColorVariantId: Types.ObjectId;
  }> = [];

  for (const group of orphanGroups.values()) {
    const source = group[0];
    const sourceSizeSetKey = getSizeSetKey(group.map((item) => item.size));
    const target = currentOptions.find((option) => {
      const optionKey = getInventoryOptionKey(option.variantId, option.colorVariantId);
      return (
        option.sizeSetKey === sourceSizeSetKey &&
        !occupiedCurrentKeys.has(optionKey) &&
        !usedTargetKeys.has(optionKey)
      );
    });

    if (!source || !target) {
      continue;
    }

    const targetKey = getInventoryOptionKey(target.variantId, target.colorVariantId);
    usedTargetKeys.add(targetKey);
    replacements.push({
      fromVariantId: new Types.ObjectId(toIdString(source.variantId)),
      fromColorVariantId: new Types.ObjectId(toIdString(source.colorVariantId)),
      toVariantId: new Types.ObjectId(target.variantId),
      toColorVariantId: new Types.ObjectId(target.colorVariantId),
    });
  }

  if (!replacements.length) {
    return;
  }

  await Promise.all(
    replacements.flatMap((replacement) => {
      const filter = {
        productId,
        variantId: replacement.fromVariantId,
        colorVariantId: replacement.fromColorVariantId,
      };
      const update = {
        $set: {
          variantId: replacement.toVariantId,
          colorVariantId: replacement.toColorVariantId,
        },
      };

      return [
        Inventory.updateMany(filter, update),
        InventoryImport.updateMany(filter, update),
        InventoryReservation.updateMany(filter, update),
      ];
    }),
  );

  replacements.forEach((replacement) => {
    inventoryItems.forEach((inventory) => {
      if (
        toIdString(inventory.variantId) === replacement.fromVariantId.toString() &&
        toIdString(inventory.colorVariantId) === replacement.fromColorVariantId.toString()
      ) {
        inventory.variantId = replacement.toVariantId;
        inventory.colorVariantId = replacement.toColorVariantId;
      }
    });
  });
};

const mapProductListItem = (
  product: ProductListDocument,
  query: ProductListQueryInput,
  inventoryByProductId: Map<string, InventoryStockDocument[]>,
) => {
  const productInventory = inventoryByProductId.get(product._id.toString()) ?? [];
  const displayVariant = selectDisplayVariant(product.variant, query, productInventory);
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
    _id: product._id.toString(),
    name: product.name,
    image: displayVariant?.colors?.[0]?.image || product.product_image,
    price: originalPrice,
    originalPrice,
    discount,
    finalPrice: getFinalPrice(originalPrice, discount),
    isSale: discount > 0,
    isNew: isNewProduct(product.createdAt),
    isAvailable: Boolean(
      displayVariant?.isActive &&
      hasVariantSize(displayVariant, query.size) &&
      hasAvailableInventoryForVariant(displayVariant, productInventory, query.size),
    ),
    soldQuantity: product.sold_quantity,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    brand,
    category,
  };
};

const mapFilterBrand = (brand: { _id: Types.ObjectId; name: string; image?: string }) => ({
  _id: brand._id.toString(),
  name: brand.name,
  image: brand.image,
});

const mapFilterCategory = (category: {
  _id: Types.ObjectId;
  name: string;
  gender?: ProductGenderFilter;
  parent_id?: Types.ObjectId | null;
  level?: number;
  image?: string;
}) => ({
  _id: category._id.toString(),
  name: category.name,
  gender: category.gender,
  parent_id: category.parent_id?.toString() ?? null,
  level: category.level,
  image: category.image,
});

const getProductListFilters = async (filter: ProductListFilter, query: ProductListQueryInput) => {
  const [brands, categories, colors, fitTypes, sizes, materials] = await Promise.all([
    Brand.find({ isActive: true }).select('_id name image').sort({ name: 1 }).lean(),
    Category.find({ isActive: true, ...(query.gender ? { gender: query.gender } : {}) })
      .select('_id name gender parent_id level image')
      .sort({ gender: 1, level: 1, name: 1 })
      .lean(),
    Product.distinct('variant.colors.color', filter),
    Product.distinct('variant.fitTypeId', filter),
    Product.distinct('variant.sizeMeasurements.size', filter),
    Product.distinct('material', { ...filter, material: { $ne: '' } }),
  ]);

  return {
    brands: brands.map(mapFilterBrand),
    colors: colors.filter(Boolean).sort(),
    fitTypes: fitTypes.filter(Boolean).map((fitTypeId) => String(fitTypeId)).sort(),
    sizes: sizes.filter(Boolean).sort(),
    categories: categories.map(mapFilterCategory),
    materials: materials.filter(Boolean).sort(),
  };
};

const PRODUCT_DETAIL_CATEGORY_PROJECTION =
  '_id name gender parent_id level image isSizeTemplateSource sizeTemplateSourceId sizeGuideImage isFitTypeTemplateSource fitTypeTemplateSourceId sizes measurementFields fitTypes';

const DEFAULT_PRODUCT_POLICIES = [
  {
    icon: 'rotate-ccw',
    title: 'Đổi trả 7 ngày',
    description: 'Hỗ trợ đổi trả theo chính sách của shop.',
  },
  {
    icon: 'shield-check',
    title: 'Kiểm tra hàng khi nhận',
    description: 'Khách hàng có thể kiểm tra sản phẩm trước khi thanh toán.',
  },
  {
    icon: 'truck',
    title: 'Giao hàng tiêu chuẩn',
    description: 'Phí vận chuyển được tính tại bước thanh toán.',
  },
];

const SOURCE_COLOR_HEX_MAP: Record<string, string> = {
  BEE: '#F5F5DC',
  BSA: '#F5F5DC',
  CAM: '#F36B26',
  CBA: '#1790C8',
  CHI: '#A0A0A0',
  CVT: '#7BBA3C',
  DDL: '#000000',
  DDO: '#E7352B',
  DEN: '#111111',
  DET: '#111111',
  DGH: '#111111',
  DKT: '#E7352B',
  DN1: '#1C1C1C',
  DOD: '#E7352B',
  GAH: '#E7352B',
  GHD: '#CCCCCC',
  GHI: '#CCCCCC',
  HG1: '#F0728F',
  HOG: '#F0728F',
  IDC: '#000000',
  IDG: '#000000',
  IDX: '#000000',
  ITC: '#FFFFFF',
  ITG: '#FFFFFF',
  ITX: '#FFFFFF',
  KEM: '#F5F5DC',
  NAD: '#825D41',
  NAN: '#825D41',
  NAU: '#825D41',
  NAV: '#000080',
  NKT: '#000080',
  NSU: '#825D41',
  REU: '#636B2F',
  TAN: '#CCCCCC',
  TGD: '#FFFFFF',
  THX: '#000080',
  TIK: '#000080',
  TIT: '#000080',
  TKA: '#FFFFFF',
  TKC: '#FFFFFF',
  TKD: '#FFFFFF',
  TKE: '#FFFFFF',
  TKG: '#CCCCCC',
  TKH: '#FFFFFF',
  TKN: '#FFFFFF',
  TKX: '#FFFFFF',
  TMT: '#FFFFFF',
  TNY: '#FFFFFF',
  TRA: '#FFFFFF',
  TRD: '#FFFFFF',
  TRG: '#FFFFFF',
  TTM: '#FFFFFF',
  VAG: '#FED533',
  XAH: '#1790C8',
  XAM: '#CCCCCC',
  XAR: '#7BBA3C',
  XBD: '#1790C8',
  XBI: '#1790C8',
  XCV: '#7BBA3C',
  XDE: '#111111',
  XH1: '#1790C8',
  XLA: '#7BBA3C',
  XLO: '#1790C8',
  XMN: '#67F0E5',
  XN1: '#1790C8',
  XNA: '#CCCCCC',
  XNG: '#67F0E5',
  XTI: '#1790C8',
};

const COLOR_NAME_HEX_MAP: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /đen|black/i, value: '#111111' },
  { pattern: /trắng|trang|white/i, value: '#FFFFFF' },
  { pattern: /be|beige|kem|cream/i, value: '#E8D8BE' },
  { pattern: /nâu|nau|brown/i, value: '#7A5137' },
  { pattern: /xám|xam|ghi|gray|grey/i, value: '#9EA4AA' },
  { pattern: /xanh navy|navy/i, value: '#1F2A44' },
  { pattern: /xanh jean|xanh dương|xanh biển|blue/i, value: '#4F7EA8' },
  { pattern: /xanh rêu|rêu|reu|olive/i, value: '#66724A' },
  { pattern: /xanh/i, value: '#5E8FB4' },
  { pattern: /đỏ|do|red/i, value: '#C62828' },
  { pattern: /hồng|hong|pink/i, value: '#E89AB5' },
  { pattern: /vàng|vang|yellow/i, value: '#F2CF62' },
  { pattern: /cam|orange/i, value: '#F2994A' },
  { pattern: /tím|tim|purple/i, value: '#7B5FA7' },
];

const isHexColor = (value?: string) => Boolean(value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()));

const resolveDisplayColorCode = (sourceColorCode?: string, colorName?: string) => {
  const normalizedCode = sourceColorCode?.trim();

  if (isHexColor(normalizedCode)) {
    return normalizedCode;
  }

  if (normalizedCode) {
    const mappedCode = SOURCE_COLOR_HEX_MAP[normalizedCode.toUpperCase()];
    if (mappedCode) {
      return mappedCode;
    }
  }

  const mappedName = COLOR_NAME_HEX_MAP.find((item) => item.pattern.test(colorName ?? ''));
  return mappedName?.value;
};

const getEmptyRatingDistribution = () => {
  return ([5, 4, 3, 2, 1] as const).map((rating) => ({
    rating,
    count: 0,
    percent: 0,
  }));
};

const getDetailCategoryById = async (categoryId?: Types.ObjectId | null) => {
  if (!categoryId) {
    return null;
  }

  return Category.findById(categoryId)
    .select(PRODUCT_DETAIL_CATEGORY_PROJECTION)
    .lean<PopulatedCategory | null>();
};

const resolveDetailCategoryTemplate = async (category: PopulatedCategory | null) => {
  if (!category) {
    return null;
  }

  if (category.isSizeTemplateSource) {
    return category;
  }

  if (category.sizeTemplateSourceId) {
    const sourceCategory = await getDetailCategoryById(category.sizeTemplateSourceId);
    if (sourceCategory) {
      return sourceCategory;
    }
  }

  if (category.fitTypes?.length || category.measurementFields?.length || category.sizes?.length) {
    return category;
  }

  if (category.parent_id) {
    const parentCategory = await getDetailCategoryById(category.parent_id);
    if (parentCategory) {
      return parentCategory;
    }
  }

  return category;
};

const resolveDetailCategoryFitTypeTemplate = async (category: PopulatedCategory | null) => {
  if (!category) {
    return null;
  }

  if (category.isFitTypeTemplateSource) {
    return category;
  }

  if (category.fitTypeTemplateSourceId) {
    const sourceCategory = await getDetailCategoryById(category.fitTypeTemplateSourceId);
    if (sourceCategory) {
      return sourceCategory;
    }
  }

  if (category.sizeTemplateSourceId) {
    const sourceCategory = await getDetailCategoryById(category.sizeTemplateSourceId);
    if (sourceCategory) {
      return sourceCategory;
    }
  }

  if (category.fitTypes?.length) {
    return category;
  }

  if (category.parent_id) {
    const parentCategory = await getDetailCategoryById(category.parent_id);
    if (parentCategory) {
      return parentCategory;
    }
  }

  return category;
};

const mapDetailBrand = (relation: ProductListDocument['brand_id']) => {
  if (!isPopulatedBrand(relation)) {
    return null;
  }

  return {
    _id: getRelationId(relation),
    name: relation.name,
    image: relation.image,
  };
};

const mapDetailCategory = (relation: ProductListDocument['category_id']) => {
  if (!isPopulatedCategory(relation)) {
    return null;
  }

  return {
    _id: getRelationId(relation),
    name: relation.name,
    gender: relation.gender,
    image: relation.image,
  };
};

const mapCategoryBreadcrumbItem = (category: PopulatedCategory): ProductCategoryBreadcrumbItem => ({
  _id: category._id.toString(),
  name: category.name,
  gender: category.gender,
  parent_id: category.parent_id?.toString() ?? null,
  level: category.level,
});

const getCategoryBreadcrumb = async (category: PopulatedCategory | null) => {
  if (!category) {
    return [];
  }

  const categories: PopulatedCategory[] = [category];
  const visitedIds = new Set([category._id.toString()]);
  let parentId = category.parent_id;

  while (parentId) {
    const parentCategory = await getDetailCategoryById(parentId);
    if (!parentCategory) {
      break;
    }

    const parentIdString = parentCategory._id.toString();
    if (visitedIds.has(parentIdString)) {
      break;
    }

    categories.unshift(parentCategory);
    visitedIds.add(parentIdString);
    parentId = parentCategory.parent_id;
  }

  return categories.map(mapCategoryBreadcrumbItem);
};

const getFitTypeMap = (category: PopulatedCategory | null) => {
  const fitTypes = category?.fitTypes ?? [];

  return new Map(
    fitTypes.map((fitType) => [
      toIdString(fitType._id),
      {
        _id: toIdString(fitType._id),
        key: fitType.key,
        label: fitType.label,
      },
    ]),
  );
};

const getMeasurementFieldMap = (category: PopulatedCategory | null) => {
  const measurementFields = category?.measurementFields ?? [];

  return new Map(
    measurementFields.map((field) => [field.key.trim().toLowerCase(), field]),
  );
};

const mapDetailColor = (color: IProductVariant['colors'][number]): ProductDetailColor => ({
  _id: toIdString(color._id),
  color: color.color,
  colorCode: resolveDisplayColorCode(color.colorCode, color.color),
  image: color.image,
});

const getVariantInventoryItems = (
  variant: IProductVariant,
  inventoryItems: InventoryStockDocument[],
) => {
  const variantId = toIdString(variant._id);
  const colorIds = new Set(variant.colors.map((color) => toIdString(color._id)));
  const sizes = new Set(variant.sizeMeasurements.map((sizeMeasurement) => sizeMeasurement.size.trim().toLowerCase()));

  return inventoryItems.filter((inventory) => {
    return (
      toIdString(inventory.variantId) === variantId &&
      colorIds.has(toIdString(inventory.colorVariantId)) &&
      sizes.has(inventory.size.trim().toLowerCase())
    );
  });
};

const getAvailableQuantityForSize = (
  size: string,
  inventoryItems: InventoryStockDocument[],
) => {
  const normalizedSize = size.trim().toLowerCase();

  return inventoryItems
    .filter((inventory) => inventory.size.trim().toLowerCase() === normalizedSize)
    .reduce((sum, inventory) => sum + Math.max(0, inventory.availableQuantity), 0);
};

const mapDetailInventoryItem = (inventory: InventoryStockDocument): ProductDetailInventoryItem => ({
  colorVariantId: toIdString(inventory.colorVariantId),
  size: inventory.size,
  sku: inventory.sku,
  availableQuantity: Math.max(0, inventory.availableQuantity),
  isAvailable: inventory.availableQuantity > 0,
});

const mapDetailVariant = (
  variant: IProductVariant,
  fitTypeMap: ReturnType<typeof getFitTypeMap>,
  measurementFieldMap: ReturnType<typeof getMeasurementFieldMap>,
  inventoryItems: InventoryStockDocument[],
): ProductDetailVariant => {
  const originalPrice = variant.price;
  const discount = variant.discount;
  const variantInventory = getVariantInventoryItems(variant, inventoryItems);

  return {
    _id: toIdString(variant._id),
    fitTypeId: toIdString(variant.fitTypeId),
    fitType: fitTypeMap.get(toIdString(variant.fitTypeId)) ?? null,
    price: originalPrice,
    originalPrice,
    discount,
    finalPrice: getFinalPrice(originalPrice, discount),
    isSale: discount > 0,
    isActive: variant.isActive,
    colors: variant.colors.map(mapDetailColor),
    sizes: variant.sizeMeasurements.map((sizeMeasurement) => ({
      size: sizeMeasurement.size,
      availableQuantity: getAvailableQuantityForSize(sizeMeasurement.size, variantInventory),
      isAvailable:
        variant.isActive &&
        getAvailableQuantityForSize(sizeMeasurement.size, variantInventory) > 0,
      measurements: sizeMeasurement.measurements.map((measurement) => {
        const field = measurementFieldMap.get(measurement.key.trim().toLowerCase());

        return {
          key: measurement.key,
          label: field?.label,
          unit: field?.unit,
          value: measurement.value,
        };
      }),
    })),
    inventory: variantInventory.map(mapDetailInventoryItem),
  };
};

const uniqueStrings = (values: string[]) => {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const getDetailColors = (variants: ProductDetailVariant[]) => {
  const colorsByKey = new Map<string, ProductDetailColor>();

  variants.forEach((variant) => {
    variant.colors.forEach((color) => {
      const key = `${color.color.trim().toLowerCase()}|${color.colorCode ?? ''}`;
      if (!colorsByKey.has(key)) {
        colorsByKey.set(key, color);
      }
    });
  });

  return Array.from(colorsByKey.values());
};

const mapProductDetail = async (
  product: ProductListDocument,
  options: { includeInactiveVariants?: boolean } = {},
): Promise<ProductDetailResponse> => {
  const category = isPopulatedCategory(product.category_id) ? product.category_id : null;
  const [templateCategory, fitTypeTemplateCategory, categoryBreadcrumb, inventoryItems] = await Promise.all([
    resolveDetailCategoryTemplate(category),
    resolveDetailCategoryFitTypeTemplate(category),
    getCategoryBreadcrumb(category),
    Inventory.find({ productId: product._id }).lean<InventoryStockDocument[]>(),
  ]);
  await repairInventoryReferencesForProduct(product._id, product.variant, inventoryItems);
  const fitTypeMap = getFitTypeMap(fitTypeTemplateCategory);
  const measurementFieldMap = getMeasurementFieldMap(templateCategory);
  const detailVariants = options.includeInactiveVariants
    ? product.variant
    : product.variant.filter((variant) => variant.isActive);
  const variants = detailVariants.map((variant) =>
    mapDetailVariant(variant, fitTypeMap, measurementFieldMap, inventoryItems),
  );
  const displayVariant =
    variants.find((variant) => variant.isActive && variant.inventory.some((inventory) => inventory.isAvailable)) ??
    variants.find((variant) => variant.isActive && variant.sizes.length > 0) ??
    variants[0];
  const originalPrice = displayVariant?.originalPrice ?? 0;
  const discount = displayVariant?.discount ?? 0;
  const selectableVariants = variants.filter((variant) => variant.isActive);

  return {
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    productImage: product.product_image,
    isActive: product.isActive,
    gallery: uniqueStrings([
      product.product_image,
      ...variants.flatMap((variant) => variant.colors.map((color) => color.image)),
    ]),
    price: originalPrice,
    originalPrice,
    discount,
    finalPrice: getFinalPrice(originalPrice, discount),
    isSale: discount > 0,
    isNew: isNewProduct(product.createdAt),
    isAvailable: selectableVariants.some((variant) =>
      variant.inventory.some((inventory) => inventory.isAvailable),
    ),
    soldQuantity: product.sold_quantity,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    brand: mapDetailBrand(product.brand_id),
    category: mapDetailCategory(product.category_id),
    categoryBreadcrumb,
    sizeGuideImage: templateCategory?.sizeGuideImage?.trim() || undefined,
    variants,
    selectedVariantId: displayVariant?._id,
    colors: getDetailColors(selectableVariants),
    sizes: uniqueStrings(selectableVariants.flatMap((variant) => variant.sizes.map((size) => size.size))),
    ratingSummary: {
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      distribution: getEmptyRatingDistribution(),
    },
    policies: DEFAULT_PRODUCT_POLICIES,
  };
};

const createProduct = async (input: CreateProductInput) => {
  await Promise.all([assertBrandExists(input.brand_id), assertCategoryExists(input.category_id)]);
  assertVariantPayload(input.variant);
  await assertVariantTemplateMatchesCategory(input.category_id, input.variant);

  return Product.create({
    category_id: new Types.ObjectId(input.category_id),
    name: input.name.trim(),
    brand_id: new Types.ObjectId(input.brand_id),
    variant: normalizeVariants(input.variant),
    description: input.description.trim(),
    product_image: normalizeProductImageUrl(input.product_image),
    isActive: input.isActive ?? true,
  });
};

const updateProduct = async (id: string, input: UpdateProductInput) => {
  assertValidObjectId(id, 'product id');

  const product = await Product.findById(id);

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  if (input.brand_id !== undefined) {
    await assertBrandExists(input.brand_id);
  }

  if (input.category_id !== undefined) {
    await assertCategoryExists(input.category_id);
  }

  if (input.variant !== undefined) {
    assertVariantPayload(input.variant);
  }

  const categoryIdToValidate = input.category_id ?? (product.category_id instanceof Types.ObjectId ? product.category_id.toString() : String(product.category_id));
  if (input.variant !== undefined) {
    await assertVariantTemplateMatchesCategory(categoryIdToValidate, input.variant);
  }

  const updateData: Record<string, unknown> = {};

  if (input.category_id !== undefined) updateData.category_id = new Types.ObjectId(input.category_id);
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.brand_id !== undefined) updateData.brand_id = new Types.ObjectId(input.brand_id);
  if (input.variant !== undefined) updateData.variant = normalizeVariants(input.variant);
  if (input.description !== undefined) updateData.description = input.description.trim();
  if (input.product_image !== undefined) updateData.product_image = normalizeProductImageUrl(input.product_image);
  if (input.isActive !== undefined) {
    if (typeof input.isActive === 'boolean') {
      updateData.isActive = input.isActive;
    } else if (input.isActive === 'true' || input.isActive === 'false') {
      updateData.isActive = input.isActive === 'true';
    } else {
      throw new ProductServiceError('Invalid isActive value', 400);
    }
  }

  const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (
    updatedProduct &&
    ['category_id', 'brand_id', 'variant', 'product_image', 'isActive'].some((field) => field in updateData)
  ) {
    await ProductVisualIndex.updateMany(
      { productId: updatedProduct._id, isActive: true },
      {
        $set: {
          isActive: false,
          lastSyncedAt: new Date(),
        },
      },
    );
  }

  return updatedProduct;
};

const deleteProduct = async (id: string) => {
  assertValidObjectId(id, 'product id');

  const product = await Product.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  );

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  await ProductVisualIndex.updateMany(
    { productId: product._id, isActive: true },
    {
      $set: {
        isActive: false,
        lastSyncedAt: new Date(),
      },
    },
  );

  return product;
};

const countActiveProductPromotions = (productId: Types.ObjectId, categoryId?: string) => {
  const now = new Date();

  return Coupon.countDocuments({
    deletedAt: null,
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: [
      { applicableProducts: productId },
      ...(categoryId && Types.ObjectId.isValid(categoryId)
        ? [{ applicableCategories: new Types.ObjectId(categoryId) }]
        : []),
    ],
  });
};

const getProductPermanentDeleteBlockReason = async ({
  productId,
  categoryId,
  soldQuantity,
  reviewCount,
  inventoryItems,
}: ProductPermanentDeleteCheckInput) => {
  const inventoryRecords =
    inventoryItems ??
    (await Inventory.find({ productId })
      .select('quantity reservedQuantity availableQuantity')
      .lean<InventoryQuantityDocument[]>());
  const hasInventoryQuantity = inventoryRecords.some((inventory) => (
    inventory.quantity > 0 ||
    inventory.reservedQuantity > 0 ||
    inventory.availableQuantity > 0
  ));

  if (hasInventoryQuantity) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì vẫn còn tồn kho hoặc hàng đang được giữ. Hãy xử lý tồn kho trước, hoặc chọn ngừng bán để ẩn sản phẩm.';
  }

  const [orderCount, inventoryImportCount, inventoryReservationCount, cartCount, favoriteCount, activePromotionCount] = await Promise.all([
    Order.countDocuments({ 'order_list.productId': productId }),
    InventoryImport.countDocuments({ productId }),
    InventoryReservation.countDocuments({ productId }),
    Cart.countDocuments({ 'product_list.productId': productId }),
    Favorite.countDocuments({ product_id: productId }),
    countActiveProductPromotions(productId, categoryId),
  ]);

  if (orderCount > 0 || soldQuantity > 0) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì đã phát sinh đơn hàng. Bạn có thể ngừng bán để ẩn sản phẩm nhưng vẫn giữ lịch sử.';
  }

  if (inventoryImportCount > 0) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì đã có phiếu nhập kho. Bạn có thể ngừng bán để giữ lại lịch sử nhập hàng.';
  }

  if (inventoryReservationCount > 0) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì vẫn còn dữ liệu giữ hàng. Hãy chọn ngừng bán nếu không muốn tiếp tục bán sản phẩm.';
  }

  if (cartCount > 0) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì đang nằm trong giỏ hàng của khách. Bạn có thể ngừng bán để khách không đặt thêm.';
  }

  if (activePromotionCount > 0) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì đang được dùng trong khuyến mãi còn hiệu lực.';
  }

  if (favoriteCount > 0 || reviewCount > 0) {
    return 'Chưa thể xóa vĩnh viễn sản phẩm này vì đã có lượt yêu thích hoặc đánh giá từ khách hàng.';
  }

  return null;
};

const permanentlyDeleteProduct = async (id: string) => {
  assertValidObjectId(id, 'product id');
  const productObjectId = new Types.ObjectId(id);

  const product = await Product.findById(id);

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  const categoryId = getRelationId(product.category_id);
  const blockReason = await getProductPermanentDeleteBlockReason({
    productId: productObjectId,
    categoryId,
    soldQuantity: product.sold_quantity,
    reviewCount: product.reviewCount,
  });

  if (blockReason) {
    throw new ProductServiceError(blockReason, 409);
  }

  await Inventory.deleteMany({ productId: productObjectId });
  await Product.findByIdAndDelete(id);
  await ProductVisualIndex.deleteMany({ productId: productObjectId });

  return product;
};

const getProducts = () => {
  return Product.find()
    .populate('brand_id')
    .populate('category_id')
    .sort({ createdAt: -1 });
};

const getManagementProducts = async (): Promise<ProductManagementItem[]> => {
  const products = await Product.aggregate<ProductManagementDocument>([
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'brands',
        localField: 'brand_id',
        foreignField: '_id',
        as: 'brand',
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $set: {
        brand: { $ifNull: [{ $arrayElemAt: ['$brand', 0] }, null] },
        category: { $ifNull: [{ $arrayElemAt: ['$category', 0] }, null] },
      },
    },
    {
      $set: {
        templateCategoryId: {
          $cond: [
            { $eq: ['$category.isFitTypeTemplateSource', true] },
            '$category._id',
            {
              $ifNull: [
                '$category.fitTypeTemplateSourceId',
                {
                  $ifNull: [
                    '$category.sizeTemplateSourceId',
                    {
                      $cond: [
                        {
                          $gt: [{ $size: { $ifNull: ['$category.fitTypes', []] } }, 0],
                        },
                        '$category._id',
                        '$category.parent_id',
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'templateCategoryId',
        foreignField: '_id',
        as: 'templateCategory',
      },
    },
    {
      $lookup: {
        from: 'inventories',
        localField: '_id',
        foreignField: 'productId',
        as: 'inventoryItems',
      },
    },
    {
      $set: {
        templateCategory: {
          $ifNull: [
            { $arrayElemAt: ['$templateCategory', 0] },
            '$category',
          ],
        },
      },
    },
    { $unset: 'templateCategoryId' },
  ]);

  return Promise.all(products.map(async (product) => {
    const category = product.category;
    const brand = product.brand;
    const templateCategory = product.templateCategory ?? category;
    const fitTypeMap = getFitTypeMap(templateCategory);
    const productInventory = product.inventoryItems ?? [];
    await repairInventoryReferencesForProduct(product._id, product.variant, productInventory);
    const inventoryByOption = groupInventoryByVariantColorAndSize(productInventory);
    const blockReason = await getProductPermanentDeleteBlockReason({
      productId: product._id,
      categoryId: toIdString(category?._id),
      soldQuantity: product.sold_quantity,
      reviewCount: product.reviewCount,
      inventoryItems: productInventory,
    });

    return {
      _id: toIdString(product._id),
      name: product.name,
      productImage: product.product_image,
      isActive: product.isActive,
      soldQuantity: product.sold_quantity,
      brandName: brand?.name ?? '',
      categoryName: category?.name ?? '',
      canDeletePermanently: !blockReason,
      ...(blockReason ? { permanentDeleteBlockReason: blockReason } : {}),
      variants: product.variant.map((variant, variantIndex) => {
        const variantId = toIdString(variant._id);
        const fitType = fitTypeMap.get(toIdString(variant.fitTypeId));

        return {
          _id: variantId,
          fitTypeId: toIdString(variant.fitTypeId),
          fitTypeLabel: fitType?.label ?? `Form ${variantIndex + 1}`,
          price: variant.price,
          discount: variant.discount,
          isActive: variant.isActive,
          colors: variant.colors.map((color) => {
            const colorId = toIdString(color._id);

            return {
              _id: colorId,
              color: color.color,
              ...(color.colorCode
                ? { colorCode: resolveDisplayColorCode(color.colorCode, color.color) }
                : {}),
              image: color.image,
              inventory: variant.sizeMeasurements.map((sizeMeasurement) => {
                const inventory = inventoryByOption.get(
                  getInventoryLookupKey(variantId, colorId, sizeMeasurement.size),
                );

                return {
                  size: sizeMeasurement.size,
                  sku: inventory?.sku ?? '',
                  availableQuantity: inventory?.availableQuantity ?? 0,
                };
              }),
            };
          }),
        };
      }),
    };
  }));
};

const getActiveProducts = () => {
  return Product.find({ isActive: true })
    .populate('brand_id')
    .populate('category_id')
    .sort({ createdAt: -1 });
};

const getProductList = async (query: ProductListQueryInput): Promise<ProductListResponse> => {
  const { page, limit } = clampPagination(query);
  const filter = await buildProductListFilter(query);
  const sort = getSortOption(query.sort);
  const priceSortedProductIds = isPriceSort(query.sort)
    ? await getPriceSortedProductIds(filter, query, query.sort, page, limit)
    : undefined;
  const priceSortOrder = new Map(
    priceSortedProductIds?.map((item, index) => [item._id.toString(), index]),
  );
  const productQuery = priceSortedProductIds
    ? Product.find({ _id: { $in: priceSortedProductIds.map((item) => item._id) } })
    : Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);

  const [products, totalItems, filters] = await Promise.all([
    productQuery
      .populate('brand_id', '_id name image')
      .populate('category_id', '_id name gender image')
      .lean<ProductListDocument[]>(),
    Product.countDocuments(filter),
    query.includeFilters === false
      ? Promise.resolve(undefined)
      : getProductListFilters(filter, query),
  ]);
  if (priceSortOrder) {
    products.sort((left, right) => {
      return (priceSortOrder.get(left._id.toString()) ?? 0) - (priceSortOrder.get(right._id.toString()) ?? 0);
    });
  }
  const inventoryItems = products.length
    ? await Inventory.find({
        productId: { $in: products.map((product) => product._id) },
      }).lean<InventoryStockDocument[]>()
    : [];
  const inventoryByProductId = groupInventoryByProductId(inventoryItems);
  await Promise.all(
    products.map((product) =>
      repairInventoryReferencesForProduct(
        product._id,
        product.variant,
        inventoryByProductId.get(product._id.toString()) ?? [],
      ),
    ),
  );

  return {
    items: products.map((product) => mapProductListItem(product, query, inventoryByProductId)),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
    ...(filters ? { filters } : {}),
  };
};

const getProductFilters = async (query: ProductListQueryInput) => {
  const filter = await buildProductListFilter(query);
  return getProductListFilters(filter, query);
};

const getProductById = async (id: string) => {
  assertValidObjectId(id, 'product id');

  const product = await Product.findById(id).populate('brand_id').populate('category_id');

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  return product;
};

const getProductDetailById = async (
  id: string,
  options: { activeOnly?: boolean } = {},
): Promise<ProductDetailResponse> => {
  assertValidObjectId(id, 'product id');
  const activeOnly = options.activeOnly ?? true;

  const product = await Product.findOne({
    _id: id,
    ...(activeOnly ? { isActive: true } : {}),
  })
    .populate('brand_id', '_id name image')
    .populate('category_id', PRODUCT_DETAIL_CATEGORY_PROJECTION)
    .lean<ProductListDocument | null>();

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  return mapProductDetail(product, { includeInactiveVariants: !activeOnly });
};

export const productService = {
  createProduct,
  updateProduct,
  deleteProduct,
  permanentlyDeleteProduct,
  getProducts,
  getManagementProducts,
  getActiveProducts,
  getProductList,
  getProductFilters,
  getProductById,
  getProductDetailById,
};
