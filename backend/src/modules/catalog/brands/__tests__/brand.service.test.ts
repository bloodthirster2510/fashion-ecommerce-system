import { Types } from 'mongoose';
import { Brand } from '../../../../database/models/brand.model';
import { Product } from '../../../../database/models/product.model';
import { brandService } from '../brand.service';

jest.mock('../../../../database/models/brand.model', () => ({
  Brand: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock('../../../../database/models/product.model', () => ({
  Product: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockedBrand = Brand as jest.Mocked<typeof Brand>;
const mockedProduct = Product as jest.Mocked<typeof Product>;
const brandId = '665000000000000000000001';

describe('brandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedProduct.updateMany.mockResolvedValue({ modifiedCount: 0 } as never);
  });

  it('blocks soft deletion when active products still use the brand unless cascade is confirmed', async () => {
    mockedProduct.countDocuments.mockResolvedValue(2);

    await expect(brandService.deleteBrand(brandId)).rejects.toMatchObject({
      message: 'Thương hiệu này vẫn còn sản phẩm đang bán. Vui lòng xác nhận ngừng bán các sản phẩm liên quan trước khi tạm ngừng thương hiệu.',
      statusCode: 409,
    });
    expect(mockedProduct.updateMany).not.toHaveBeenCalled();
    expect(mockedBrand.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('soft deletes a brand and cascades active products when confirmed', async () => {
    const brand = { _id: new Types.ObjectId(brandId), isActive: false };
    mockedProduct.countDocuments.mockResolvedValue(2);
    mockedBrand.findByIdAndUpdate.mockResolvedValue(brand as never);

    const result = await brandService.deleteBrand(brandId, { cascadeProducts: true });

    expect(mockedProduct.updateMany).toHaveBeenCalledWith(
      {
        brand_id: new Types.ObjectId(brandId),
        isActive: true,
      },
      { isActive: false },
    );
    expect(mockedBrand.findByIdAndUpdate).toHaveBeenCalledWith(
      brandId,
      { isActive: false },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(result).toBe(brand);
  });

  it('includes active product counts for brand management', async () => {
    const brand = {
      _id: new Types.ObjectId(brandId),
      name: 'YODY',
      image: 'https://res.cloudinary.com/demo/image/upload/v1/brands/yody.png',
      isActive: true,
    };
    mockedBrand.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([brand]),
    } as never);
    mockedProduct.aggregate.mockResolvedValue([
      { _id: brand._id, count: 3, activeCount: 2 },
    ] as never);

    const result = await brandService.getBrandsForManagement();

    expect(result).toEqual([
      expect.objectContaining({
        _id: brand._id,
        productCount: 3,
        activeProductCount: 2,
      }),
    ]);
  });
});
