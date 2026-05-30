import { SortOrder, Types } from 'mongoose';
import { Brand, Category, Product, type ICategory, type IProductVariant } from '../../../database/models';
import type {
  CreateProductInput,
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

const matchesVariantQuery = (variant: IProductVariant, query: ProductListQueryInput) => {
  if (!variant.isActive || !hasVariantSize(variant, query.size)) {
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

const selectDisplayVariant = (variants: IProductVariant[], query: ProductListQueryInput) => {
  return (
    variants.find((variant) => matchesVariantQuery(variant, query)) ??
    variants.find((variant) => variant.isActive && hasVariantSize(variant)) ??
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
  if (query.categoryId) {
    return getDescendantCategoryIds(query.categoryId, query.gender);
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

  if (query.brandId) {
    assertValidObjectId(query.brandId, 'brand id');
    filter.brand_id = new Types.ObjectId(query.brandId);
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

const getRelationId = (relation: Types.ObjectId | { _id: Types.ObjectId } | null | undefined) => {
  if (!relation) {
    return '';
  }

  if (relation instanceof Types.ObjectId) {
    return relation.toString();
  }

  return relation._id.toString();
};

const isPopulatedBrand = (relation: ProductListDocument['brand_id']): relation is PopulatedBrand => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);
};

const isPopulatedCategory = (
  relation: ProductListDocument['category_id'],
): relation is PopulatedCategory => {
  return Boolean(relation && !(relation instanceof Types.ObjectId) && 'name' in relation);
};

const mapProductListItem = (product: ProductListDocument, query: ProductListQueryInput) => {
  const displayVariant = selectDisplayVariant(product.variant, query);
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
    isAvailable: Boolean(displayVariant?.isActive && hasVariantSize(displayVariant)),
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
  const [brands, categories, colors, fitTypes] = await Promise.all([
    Brand.find({ isActive: true }).select('_id name image').sort({ name: 1 }).lean(),
    Category.find({ isActive: true, ...(query.gender ? { gender: query.gender } : {}) })
      .select('_id name gender parent_id level image bannerImage')
      .sort({ gender: 1, level: 1, name: 1 })
      .lean(),
    Product.distinct('variant.colors.color', filter),
    Product.distinct('variant.fitTypeId', filter),
  ]);

  return {
    brands: brands.map(mapFilterBrand),
    colors: colors.filter(Boolean).sort(),
    fitTypes: fitTypes.filter(Boolean).map((fitTypeId) => String(fitTypeId)).sort(),
    categories: categories.map(mapFilterCategory),
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

  return {
    items: products.map((product) => mapProductListItem(product, query)),
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

export const productService = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getActiveProducts,
  getProductList,
  getProductById,
};
