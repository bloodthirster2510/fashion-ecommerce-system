import { Types } from 'mongoose';
import { Brand } from '../../../database/models/brand.model';
import { Product } from '../../../database/models/product.model';
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

const createBrand = async (input: CreateBrandInput) => {
  const existingBrand = await findBrandByName(input.name);

  if (existingBrand) {
    throw new BrandServiceError('Brand name already exists', 409);
  }

  return Brand.create({
    name: input.name.trim(),
    image: input.image.trim(),
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
  if (input.image !== undefined) updateData.image = input.image.trim();
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  return Brand.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteBrand = async (id: string) => {
  assertValidBrandId(id);

  const brand = await Brand.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      new: true,
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
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $group: { _id: '$brand_id', count: { $sum: 1 } } },
    ]),
  ]);
  const countByBrandId = new Map(
    productCounts.map((item) => [item._id.toString(), item.count]),
  );

  return brands.map((brand) => ({
    ...brand,
    productCount: countByBrandId.get(brand._id.toString()) ?? 0,
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
