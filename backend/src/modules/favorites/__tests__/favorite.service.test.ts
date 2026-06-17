import { Types } from 'mongoose';
import { Favorite, Inventory, Product } from '../../../database/models';
import { favoriteService } from '../favorite.service';

jest.mock('../../../database/models', () => ({
  Favorite: {
    countDocuments: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  },
  Inventory: {
    find: jest.fn(),
  },
  Product: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

const mockedFavorite = Favorite as unknown as {
  countDocuments: jest.Mock;
  deleteOne: jest.Mock;
  find: jest.Mock;
  updateOne: jest.Mock;
};
const mockedInventory = Inventory as unknown as { find: jest.Mock };
const mockedProduct = Product as unknown as { find: jest.Mock; findOne: jest.Mock };

const userId = '665000000000000000000020';
const productId = new Types.ObjectId('665000000000000000000003');
const brandId = new Types.ObjectId('665000000000000000000004');
const categoryId = new Types.ObjectId('665000000000000000000005');
const variantId = new Types.ObjectId('665000000000000000000011');
const fitTypeId = new Types.ObjectId('665000000000000000000010');
const colorVariantId = new Types.ObjectId('665000000000000000000012');
const favoritedAt = new Date('2026-05-30T10:00:00.000Z');

const mockFavoriteFind = (value: unknown) => {
  mockedFavorite.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  });
};

const mockProductFind = (value: unknown) => {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
  mockedProduct.find.mockReturnValue(chain);
};

const mockInventoryFind = (value: unknown) => {
  mockedInventory.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  });
};

const mockProductFindOne = (value: unknown) => {
  mockedProduct.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  });
};

const product = {
  _id: productId,
  category_id: {
    _id: categoryId,
    name: 'Ao thun',
    gender: 'unisex',
    image: 'https://example.com/category.png',
  },
  name: 'Basic Tee',
  brand_id: {
    _id: brandId,
    name: 'Fashionista',
    image: 'https://example.com/brand.png',
  },
  variant: [
    {
      _id: variantId,
      fitTypeId,
      price: 200000,
      discount: 10,
      sizeMeasurements: [{ size: 'M', measurements: [] }],
      colors: [
        {
          _id: colorVariantId,
          color: 'Black',
          image: 'https://example.com/black.png',
        },
      ],
      isActive: true,
    },
  ],
  description: 'Cotton tee for daily wear',
  product_image: 'https://example.com/product.png',
  isActive: true,
  sold_quantity: 12,
  averageRating: 4.5,
  reviewCount: 8,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-02T00:00:00.000Z'),
};

const inventory = {
  productId,
  variantId,
  colorVariantId,
  size: 'M',
  sku: 'TEE-BLK-M',
  availableQuantity: 5,
};

describe('favoriteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns favorite status for a product', async () => {
    mockedFavorite.countDocuments.mockResolvedValue(1);

    const result = await favoriteService.getFavoriteStatus(userId, productId.toString());

    expect(mockedFavorite.countDocuments).toHaveBeenCalledWith({
      user_id: new Types.ObjectId(userId),
      product_id: productId,
    });
    expect(result).toEqual({
      productId: productId.toString(),
      isFavorited: true,
    });
  });

  it('adds a favorite only when the product is active', async () => {
    mockProductFindOne({ _id: productId });
    mockedFavorite.updateOne.mockResolvedValue({ acknowledged: true });

    const result = await favoriteService.addFavorite(userId, productId.toString());

    expect(mockedProduct.findOne).toHaveBeenCalledWith({ _id: productId, isActive: true });
    expect(mockedFavorite.updateOne).toHaveBeenCalledWith(
      { user_id: new Types.ObjectId(userId), product_id: productId },
      { $setOnInsert: { user_id: new Types.ObjectId(userId), product_id: productId } },
      { upsert: true },
    );
    expect(result).toEqual({
      productId: productId.toString(),
      isFavorited: true,
    });
  });

  it('rejects adding an unavailable product', async () => {
    mockProductFindOne(null);

    await expect(favoriteService.addFavorite(userId, productId.toString())).rejects.toMatchObject({
      message: 'Product is not available',
      statusCode: 404,
    });

    expect(mockedFavorite.updateOne).not.toHaveBeenCalled();
  });

  it('lists favorite products with catalog fields and inventory state', async () => {
    mockFavoriteFind([{ product_id: productId, createdAt: favoritedAt }]);
    mockProductFind([product]);
    mockInventoryFind([inventory]);

    const result = await favoriteService.listFavorites(userId, { page: 1, limit: 10 });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 1,
      totalPages: 1,
    });
    expect(result.items[0]).toMatchObject({
      _id: productId.toString(),
      name: 'Basic Tee',
      image: 'https://example.com/black.png',
      price: 200000,
      originalPrice: 200000,
      discount: 10,
      finalPrice: 180000,
      isSale: true,
      isAvailable: true,
      soldQuantity: 12,
      averageRating: 4.5,
      reviewCount: 8,
      favoritedAt: favoritedAt.toISOString(),
      isFavorited: true,
      brand: {
        _id: brandId.toString(),
        name: 'Fashionista',
      },
      category: {
        _id: categoryId.toString(),
        name: 'Ao thun',
      },
    });
  });
});
