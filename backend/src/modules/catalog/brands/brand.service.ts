import { Types } from 'mongoose';
import { Brand } from '../../../database/models/brand.model';
import { Product } from '../../../database/models/product.model';
import { CatalogImageUrlError, normalizeCatalogImageUrl } from '../catalog-image';
import type { CreateBrandInput, UpdateBrandInput } from './brand.types';

export class BrandServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'BrandServiceError';
  }
}

const assertValidBrandId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new BrandServiceError('Invalid brand id', 400);
  }
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const findBrandByName = (name: string) => {
  return Brand.findOne({
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
  });
};

const normalizeBrandImageUrl = (imageUrl: string) => {
  try {
    return normalizeCatalogImageUrl(imageUrl);
  } catch (error) {
    if (error instanceof CatalogImageUrlError) {
      throw new BrandServiceError(error.message, 400);
    }

    throw error;
  }
};

const normalizeStoredImageUrl = (imageUrl?: string | null) => String(imageUrl ?? '').trim();

const createBrand = async (input: CreateBrandInput) => {
  const existingBrand = await findBrandByName(input.name);

  if (existingBrand) {
    throw new BrandServiceError('Brand name already exists', 409);
  }

  return Brand.create({
    name: input.name.trim(),
    image: normalizeBrandImageUrl(input.image),
  });
};

const updateBrand = async (id: string, input: UpdateBrandInput) => {
  assertValidBrandId(id);

  const brand = await Brand.findById(id);

  if (!brand) {
    throw new BrandServiceError('Brand not found', 404);
  }

  if (input.name !== undefined) {
    const existingBrand = await findBrandByName(input.name);

    if (existingBrand && existingBrand._id.toString() !== id) {
      throw new BrandServiceError('Brand name already exists', 409);
    }
  }

  const updateData: UpdateBrandInput = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (
    input.image !== undefined &&
    normalizeStoredImageUrl(input.image) !== normalizeStoredImageUrl(brand.image)
  ) {
    updateData.image = normalizeBrandImageUrl(input.image);
  }
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  return Brand.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });
};

type DeleteBrandOptions = {
  cascadeProducts?: boolean;
};

const deleteBrand = async (id: string, options: DeleteBrandOptions = {}) => {
  assertValidBrandId(id);
  const brandObjectId = new Types.ObjectId(id);
  const activeProductFilter = {
    brand_id: brandObjectId,
    isActive: true,
  };
  const activeProductCount = await Product.countDocuments(activeProductFilter);

  if (activeProductCount > 0 && !options.cascadeProducts) {
    throw new BrandServiceError(
      'Thương hiệu này vẫn còn sản phẩm đang bán. Vui lòng xác nhận ngừng bán các sản phẩm liên quan trước khi tạm ngừng thương hiệu.',
      409,
    );
  }

  if (activeProductCount > 0) {
    await Product.updateMany(activeProductFilter, { isActive: false });
  }

  const brand = await Brand.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  );

  if (!brand) {
    throw new BrandServiceError('Brand not found', 404);
  }

  return brand;
};

const getBrands = () => {
  return Brand.find().sort({ createdAt: -1 });
};

const getBrandById = async (id: string) => {
  assertValidBrandId(id);
  const brand = await Brand.findById(id);

  if (!brand) {
    throw new BrandServiceError('Brand not found', 404);
  }

  return brand;
};

const deleteBrandPermanently = async (id: string) => {
  assertValidBrandId(id);

  const productCount = await Product.countDocuments({ brand_id: new Types.ObjectId(id) });

  if (productCount > 0) {
    throw new BrandServiceError('Cannot permanently delete a brand with products', 409);
  }

  const brand = await Brand.findByIdAndDelete(id);

  if (!brand) {
    throw new BrandServiceError('Brand not found', 404);
  }

  return brand;
};

const getBrandsForManagement = async () => {
  const [brands, productCounts] = await Promise.all([
    Brand.find()
      .select('_id name image isActive createdAt updatedAt')
      .sort({ name: 1 })
      .lean(),
    Product.aggregate<{ _id: Types.ObjectId; count: number; activeCount: number }>([
      {
        $group: {
          _id: '$brand_id',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
    ]),
  ]);
  const countByBrandId = new Map(
    productCounts.map((item) => [item._id.toString(), item.count]),
  );
  const activeCountByBrandId = new Map(
    productCounts.map((item) => [item._id.toString(), item.activeCount]),
  );

  return brands.map((brand) => ({
    ...brand,
    productCount: countByBrandId.get(brand._id.toString()) ?? 0,
    activeProductCount: activeCountByBrandId.get(brand._id.toString()) ?? 0,
  }));
};

const getActiveBrands = () => {
  return Brand.find({ isActive: true }).sort({ createdAt: -1 });
};

export const brandService = {
  createBrand,
  updateBrand,
  deleteBrand,
  deleteBrandPermanently,
  getBrands,
  getBrandById,
  getBrandsForManagement,
  getActiveBrands,
};
