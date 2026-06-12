import { SortOrder, Types } from 'mongoose';
import {
  Brand,
  Category,
  Inventory,
  Product,
  type ICategory,
  type ICategoryFitType,
  type IInventory,
  type IMeasurementField,
  type IProductVariant,
} from '../../../database/models';
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
  ProductSortOption,
  ProductVariantInput,
  UpdateProductInput,
} from './product.types';

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
};

const assertCategoryExists = async (categoryId: string) => {
  assertValidObjectId(categoryId, 'category id');

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ProductServiceError('Category not found', 404);
  }
};

const normalizeVariants = (variants?: ProductVariantInput[]) => {
  if (!variants) {
    return [];
  }

  return variants.map((variant) => {
    if (!variant.fitTypeId || !variant.fitTypeId.trim()) {
      throw new ProductServiceError('Variant fitTypeId is required', 400);
    }

    return {
      fitTypeId: new Types.ObjectId(variant.fitTypeId.trim()),
      price: variant.price,
      discount: variant.discount,
      sizeMeasurements: variant.sizeMeasurements.map((sizeMeasurement) => ({
        size: sizeMeasurement.size.trim(),
        measurements: sizeMeasurement.measurements.map((measurement) => ({
          key: measurement.key.trim(),
          value: measurement.value,
        })),
      })),
      colors: variant.colors.map((color) => ({
        color: color.color.trim(),
        colorCode: color.colorCode?.trim(),
        image: color.image.trim(),
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
      throw new ProductServiceError('Variant must include at least one size measurement', 400);
    }

    if (!variant.colors?.length) {
      throw new ProductServiceError('Variant must include at least one color option', 400);
    }
  }
};

const assertVariantPayload = (variants?: ProductVariantInput[]) => {
  assertUniqueFitTypesInPayload(variants);
  assertVariantSizesAndColors(variants);
  assertVariantValuesValid(variants);
};

const resolveCategoryTemplateSource = async (categoryId: string): Promise<ICategory> => {
  assertValidObjectId(categoryId, 'category id');

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ProductServiceError('Category not found', 404);
  }

  if (category.isSizeTemplateSource) {
    return category;
  }

  if (category.sizeTemplateSourceId) {
    const sourceCategory = await Category.findById(category.sizeTemplateSourceId);
    if (!sourceCategory) {
      throw new ProductServiceError('Size template source category not found', 404);
    }
    return sourceCategory;
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

  const templateCategory = await resolveCategoryTemplateSource(categoryId);
  const allowedSizeMap = new Map(templateCategory.sizes.map((size) => [size.trim().toLowerCase(), true]));
  const measurementKeys = templateCategory.measurementFields.map((field) => field.key.trim().toLowerCase());
  const requiredMeasurements = templateCategory.measurementFields
    .filter((field) => field.required)
    .map((field) => field.key.trim().toLowerCase());
  const allowedFitTypeIds = new Set(
    templateCategory.fitTypes.map((fitType) => fitType._id.toString()),
  );

  for (const variant of variants) {
    if (!allowedFitTypeIds.has(variant.fitTypeId.trim())) {
      throw new ProductServiceError('Variant fitTypeId is not valid for this category', 400);
    }

    for (const sizeMeasurement of variant.sizeMeasurements) {
      const size = sizeMeasurement.size.trim().toLowerCase();
      if (!allowedSizeMap.has(size)) {
        throw new ProductServiceError(`Size ${sizeMeasurement.size} is not allowed for this category`, 400);
      }

      const measurementKeysForSize = sizeMeasurement.measurements.map((measurement) => measurement.key.trim().toLowerCase());
      for (const requiredKey of requiredMeasurements) {
        if (!measurementKeysForSize.includes(requiredKey)) {
          throw new ProductServiceError(
            `Measurement ${requiredKey} is required for size ${sizeMeasurement.size}`,
            400,
          );
        }
      }

      for (const measurement of sizeMeasurement.measurements) {
        const key = measurement.key.trim().toLowerCase();
        if (!measurementKeys.includes(key)) {
          throw new ProductServiceError(
            `Measurement key ${measurement.key} is not valid for this category`,
            400,
          );
        }
      }
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
  bannerImage?: string | null;
  isSizeTemplateSource?: boolean;
  sizeTemplateSourceId?: Types.ObjectId | null;
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
  inventoryItems?: InventoryStockDocument[],
) => {
  if (!variant.isActive || !hasVariantSize(variant, query.size)) {
    return false;
  }

  if (!hasAvailableInventoryForVariant(variant, inventoryItems, query.size)) {
    return false;
  }

  if (!matchesTextList(variant.colors?.[0]?.color ?? '', query.color) && query.color?.length) {
    return variant.colors.some((color) => matchesTextList(color.color, query.color));
  }

  if (!matchesObjectIdList(variant.fitTypeId, query.fitType)) {
    return false;
  }

  if (query.minPrice !== undefined && variant.price < query.minPrice) {
    return false;
  }

  if (query.maxPrice !== undefined && variant.price > query.maxPrice) {
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
  return (
    variants.find((variant) => matchesVariantQuery(variant, query, inventoryItems)) ??
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
    case 'price_asc':
      return { 'variant.price': 1, createdAt: -1 };
    case 'price_desc':
      return { 'variant.price': -1, createdAt: -1 };
    case 'best_seller':
      return { sold_quantity: -1, createdAt: -1 };
    case 'rating_desc':
      return { averageRating: -1, reviewCount: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
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

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    variantFilter.price = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
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
    throw new ProductServiceError('Category not found', 404);
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

const buildKeywordConditions = async (keyword?: string) => {
  const trimmedKeyword = keyword?.trim();

  if (!trimmedKeyword) {
    return undefined;
  }

  const keywordRegex = new RegExp(escapeRegex(trimmedKeyword), 'i');
  const [brands, categories] = await Promise.all([
    Brand.find({ name: keywordRegex, isActive: true }).select('_id').lean(),
    Category.find({ name: keywordRegex, isActive: true }).select('_id').lean(),
  ]);

  return [
    { name: keywordRegex },
    { description: keywordRegex },
    ...(brands.length ? [{ brand_id: { $in: brands.map((brand) => brand._id) } }] : []),
    ...(categories.length ? [{ category_id: { $in: categories.map((category) => category._id) } }] : []),
  ];
};

type ProductListFilter = Record<string, unknown>;

const buildProductListFilter = async (query: ProductListQueryInput): Promise<ProductListFilter> => {
  const filter: ProductListFilter = {
    isActive: true,
    variant: { $elemMatch: buildVariantFilter(query) },
  };

  const categoryIds = await resolveCategoryFilter(query);
  if (categoryIds) {
    filter.category_id = { $in: categoryIds };
  }

  if (query.brandId?.length) {
    query.brandId.forEach((brandId) => assertValidObjectId(brandId, 'brand id'));
    filter.brand_id = { $in: query.brandId.map((brandId) => new Types.ObjectId(brandId)) };
  }

  if (query.isNew) {
    filter.createdAt = { $gte: getNewProductCutoff() };
  }

  const keywordConditions = await buildKeywordConditions(query.keyword);
  if (keywordConditions?.length) {
    filter.$or = keywordConditions;
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
        bannerImage: product.category_id.bannerImage ?? null,
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
  bannerImage?: string | null;
}) => ({
  _id: category._id.toString(),
  name: category.name,
  gender: category.gender,
  parent_id: category.parent_id?.toString() ?? null,
  level: category.level,
  image: category.image,
  bannerImage: category.bannerImage ?? null,
});

const getProductListFilters = async (filter: ProductListFilter, query: ProductListQueryInput) => {
  const [brands, categories, colors, fitTypes, sizes] = await Promise.all([
    Brand.find({ isActive: true }).select('_id name image').sort({ name: 1 }).lean(),
    Category.find({ isActive: true, ...(query.gender ? { gender: query.gender } : {}) })
      .select('_id name gender parent_id level image bannerImage')
      .sort({ gender: 1, level: 1, name: 1 })
      .lean(),
    Product.distinct('variant.colors.color', filter),
    Product.distinct('variant.fitTypeId', filter),
    Product.distinct('variant.sizeMeasurements.size', filter),
  ]);

  return {
    brands: brands.map(mapFilterBrand),
    colors: colors.filter(Boolean).sort(),
    fitTypes: fitTypes.filter(Boolean).map((fitTypeId) => String(fitTypeId)).sort(),
    sizes: sizes.filter(Boolean).sort(),
    categories: categories.map(mapFilterCategory),
  };
};

const PRODUCT_DETAIL_CATEGORY_PROJECTION =
  '_id name gender parent_id level image bannerImage isSizeTemplateSource sizeTemplateSourceId sizes measurementFields fitTypes';

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
    bannerImage: relation.bannerImage ?? null,
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

const mapProductDetail = async (product: ProductListDocument): Promise<ProductDetailResponse> => {
  const category = isPopulatedCategory(product.category_id) ? product.category_id : null;
  const [templateCategory, categoryBreadcrumb, inventoryItems] = await Promise.all([
    resolveDetailCategoryTemplate(category),
    getCategoryBreadcrumb(category),
    Inventory.find({ productId: product._id }).lean<InventoryStockDocument[]>(),
  ]);
  const fitTypeMap = getFitTypeMap(templateCategory);
  const measurementFieldMap = getMeasurementFieldMap(templateCategory);
  const variants = product.variant.map((variant) =>
    mapDetailVariant(variant, fitTypeMap, measurementFieldMap, inventoryItems),
  );
  const displayVariant =
    variants.find((variant) => variant.isActive && variant.inventory.some((inventory) => inventory.isAvailable)) ??
    variants.find((variant) => variant.isActive && variant.sizes.length > 0) ??
    variants[0];
  const originalPrice = displayVariant?.originalPrice ?? 0;
  const discount = displayVariant?.discount ?? 0;
  const selectableVariants = variants.some((variant) => variant.isActive)
    ? variants.filter((variant) => variant.isActive)
    : variants;

  return {
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    productImage: product.product_image,
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
    product_image: input.product_image.trim(),
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
  if (input.product_image !== undefined) updateData.product_image = input.product_image.trim();
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.sold_quantity !== undefined) updateData.sold_quantity = input.sold_quantity;
  if (input.averageRating !== undefined) updateData.averageRating = input.averageRating;
  if (input.reviewCount !== undefined) updateData.reviewCount = input.reviewCount;

  return Product.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteProduct = async (id: string) => {
  assertValidObjectId(id, 'product id');

  const product = await Product.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  return product;
};

const getProducts = () => {
  return Product.find()
    .populate('brand_id')
    .populate('category_id')
    .sort({ createdAt: -1 });
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

  const [products, totalItems, filters] = await Promise.all([
    Product.find(filter)
      .populate('brand_id', '_id name image')
      .populate('category_id', '_id name gender image bannerImage')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<ProductListDocument[]>(),
    Product.countDocuments(filter),
    getProductListFilters(filter, query),
  ]);
  const inventoryItems = products.length
    ? await Inventory.find({
        productId: { $in: products.map((product) => product._id) },
        availableQuantity: { $gt: 0 },
      }).lean<InventoryStockDocument[]>()
    : [];
  const inventoryByProductId = groupInventoryByProductId(inventoryItems);

  return {
    items: products.map((product) => mapProductListItem(product, query, inventoryByProductId)),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
    filters,
  };
};

const getProductById = async (id: string) => {
  assertValidObjectId(id, 'product id');

  const product = await Product.findById(id).populate('brand_id').populate('category_id');

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  return product;
};

const getProductDetailById = async (id: string): Promise<ProductDetailResponse> => {
  assertValidObjectId(id, 'product id');

  const product = await Product.findOne({ _id: id, isActive: true })
    .populate('brand_id', '_id name image')
    .populate('category_id', PRODUCT_DETAIL_CATEGORY_PROJECTION)
    .lean<ProductListDocument | null>();

  if (!product) {
    throw new ProductServiceError('Product not found', 404);
  }

  return mapProductDetail(product);
};

export const productService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getActiveProducts,
  getProductList,
  getProductById,
  getProductDetailById,
};
