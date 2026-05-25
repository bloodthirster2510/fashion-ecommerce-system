import { Types } from 'mongoose';
import { Brand, Category, Product } from '../../../database/models';
import type { CreateProductInput, ProductVersionInput, UpdateProductInput } from './product.types';

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

const normalizeImportIds = (importIds?: string[]) => {
  if (!importIds) {
    return [];
  }

  return importIds.map((importId) => {
    assertValidObjectId(importId, 'import id');
    return new Types.ObjectId(importId);
  });
};

const normalizeVersions = (versions?: ProductVersionInput[]) => {
  if (!versions) {
    return [];
  }

  return versions.map((version) => ({
    sku: version.sku.trim(),
    color: version.color.trim(),
    fitType: version.fitType.trim(),
    size_spec: version.size_spec,
    version_image: version.version_image.trim(),
    image_embedding: version.image_embedding ?? [],
    price: version.price,
    discount: version.discount,
    isAvailable: version.isAvailable ?? true,
    import: normalizeImportIds(version.import),
  }));
};

const assertUniqueSkusInPayload = (versions?: ProductVersionInput[]) => {
  if (!versions?.length) {
    return;
  }

  const normalizedSkus = versions.map((version) => version.sku.trim().toLowerCase());
  const uniqueSkus = new Set(normalizedSkus);

  if (uniqueSkus.size !== normalizedSkus.length) {
    throw new ProductServiceError('Duplicate SKU in product versions', 400);
  }
};

const assertSkusDoNotExist = async (versions?: ProductVersionInput[], productId?: string) => {
  if (!versions?.length) {
    return;
  }

  const skus = versions.map((version) => version.sku.trim());
  const existingProduct = await Product.findOne({
    _id: productId ? { $ne: productId } : { $exists: true },
    'version.sku': { $in: skus },
  });

  if (existingProduct) {
    throw new ProductServiceError('SKU already exists', 409);
  }
};

const createProduct = async (input: CreateProductInput) => {
  await Promise.all([assertBrandExists(input.brand_id), assertCategoryExists(input.category_id)]);
  assertUniqueSkusInPayload(input.version);
  await assertSkusDoNotExist(input.version);

  return Product.create({
    category_id: new Types.ObjectId(input.category_id),
    name: input.name.trim(),
    brand_id: new Types.ObjectId(input.brand_id),
    version: normalizeVersions(input.version),
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

  if (input.version !== undefined) {
    assertUniqueSkusInPayload(input.version);
    await assertSkusDoNotExist(input.version, id);
  }

  const updateData: Record<string, unknown> = {};

  if (input.category_id !== undefined) updateData.category_id = new Types.ObjectId(input.category_id);
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.brand_id !== undefined) updateData.brand_id = new Types.ObjectId(input.brand_id);
  if (input.version !== undefined) updateData.version = normalizeVersions(input.version);
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
  getProductById,
};
