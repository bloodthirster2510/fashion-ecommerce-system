import { Brand } from '../../../../database/models/brand.model';
import { BrandServiceError, brandService } from '../brand.service';

jest.mock('../../../../database/models/brand.model', () => ({
  Brand: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

const mockedBrand = Brand as jest.Mocked<typeof Brand>;

describe('brandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a brand with trimmed data', async () => {
    const brand = { _id: 'brand-id', name: 'Nike', image: 'https://example.com/nike.png' };
    mockedBrand.findOne.mockResolvedValue(null);
    mockedBrand.create.mockResolvedValue(brand as never);

    const result = await brandService.createBrand({
      name: ' Nike ',
      image: ' https://example.com/nike.png ',
    });

    expect(mockedBrand.findOne).toHaveBeenCalledWith({ name: /^Nike$/i });
    expect(mockedBrand.create).toHaveBeenCalledWith({
      name: 'Nike',
      image: 'https://example.com/nike.png',
    });
    expect(result).toBe(brand);
  });

  it('throws 409 when brand name already exists', async () => {
    mockedBrand.findOne.mockResolvedValue({ _id: 'brand-id' } as never);

    await expect(
      brandService.createBrand({
        name: 'Nike',
        image: 'https://example.com/nike.png',
      }),
    ).rejects.toMatchObject({
      message: 'Brand name already exists',
      statusCode: 409,
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
});
