import { Brand } from '../../../../database/models/brand.model';
import { Product } from '../../../../database/models/product.model';
import { BrandServiceError, brandService } from '../brand.service';

jest.mock('../../../../database/models/brand.model', () => ({
  Brand: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../../../database/models/product.model', () => ({
  Product: {
    countDocuments: jest.fn(),
  },
}));

const mockedBrand = Brand as jest.Mocked<typeof Brand>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const brandImageUrl = 'https://res.cloudinary.com/demo/image/upload/v1/brands/nike.png';

describe('brandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a brand with trimmed data', async () => {
    const brand = { _id: 'brand-id', name: 'Nike', image: brandImageUrl };
    mockedBrand.findOne.mockResolvedValue(null);
    mockedBrand.create.mockResolvedValue(brand as never);

    const result = await brandService.createBrand({
      name: ' Nike ',
      image: ` ${brandImageUrl} `,
    });

    expect(mockedBrand.findOne).toHaveBeenCalledWith({ name: /^Nike$/i });
    expect(mockedBrand.create).toHaveBeenCalledWith({
      name: 'Nike',
      image: brandImageUrl,
    });
    expect(result).toBe(brand);
  });

  it('throws 409 when brand name already exists', async () => {
    mockedBrand.findOne.mockResolvedValue({ _id: 'brand-id' } as never);

    await expect(
      brandService.createBrand({
        name: 'Nike',
        image: brandImageUrl,
      }),
    ).rejects.toMatchObject({
      message: 'Brand name already exists',
      statusCode: 409,
    });
  });

  it('throws 400 when brand image URL is not a whitelisted Cloudinary host', async () => {
    mockedBrand.findOne.mockResolvedValue(null);

    await expect(
      brandService.createBrand({
        name: 'Nike',
        image: 'https://example.com/nike.png',
      }),
    ).rejects.toMatchObject({
      message: 'Image URL host is not allowed',
      statusCode: 400,
    });
  });

  it('throws 400 when update id is invalid', async () => {
    await expect(brandService.updateBrand('invalid-id', { name: 'Nike' })).rejects.toBeInstanceOf(
      BrandServiceError,
    );

    await expect(brandService.updateBrand('invalid-id', { name: 'Nike' })).rejects.toMatchObject({
      message: 'Invalid brand id',
      statusCode: 400,
    });
  });

  it('throws 404 when updating a missing brand', async () => {
    mockedBrand.findById.mockResolvedValue(null);

    await expect(
      brandService.updateBrand('665000000000000000000001', { name: 'Nike' }),
    ).rejects.toMatchObject({
      message: 'Brand not found',
      statusCode: 404,
    });
  });

  it('normalizes brand fields when updating', async () => {
    const brandId = '665000000000000000000001';
    const brand = { _id: brandId, name: 'Nike' };
    mockedBrand.findById.mockResolvedValue(brand as never);
    mockedBrand.findOne.mockResolvedValue(null);
    mockedBrand.findByIdAndUpdate.mockResolvedValue(brand as never);

    await brandService.updateBrand(brandId, {
      name: ' Nike ',
      image: ` ${brandImageUrl} `,
      isActive: true,
    });

    expect(mockedBrand.findByIdAndUpdate).toHaveBeenCalledWith(
      brandId,
      {
        name: 'Nike',
        image: brandImageUrl,
        isActive: true,
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
  });

  it('soft deletes a brand by setting isActive to false', async () => {
    const brand = { _id: '665000000000000000000001', isActive: false };
    mockedBrand.findByIdAndUpdate.mockResolvedValue(brand as never);

    const result = await brandService.deleteBrand('665000000000000000000001');

    expect(mockedBrand.findByIdAndUpdate).toHaveBeenCalledWith(
      '665000000000000000000001',
      { isActive: false },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(result).toBe(brand);
  });

  it('prevents permanent deletion when a brand has products', async () => {
    mockedProduct.countDocuments.mockResolvedValue(1);

    await expect(
      brandService.deleteBrandPermanently('665000000000000000000001'),
    ).rejects.toMatchObject({
      message: 'Cannot permanently delete a brand with products',
      statusCode: 409,
    });

    expect(mockedBrand.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('permanently deletes a brand when it has no products', async () => {
    const brand = { _id: '665000000000000000000001', name: 'Nike' };
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedBrand.findByIdAndDelete.mockResolvedValue(brand as never);

    const result = await brandService.deleteBrandPermanently('665000000000000000000001');

    expect(mockedBrand.findByIdAndDelete).toHaveBeenCalledWith(
      '665000000000000000000001',
    );
    expect(result).toBe(brand);
  });
});
