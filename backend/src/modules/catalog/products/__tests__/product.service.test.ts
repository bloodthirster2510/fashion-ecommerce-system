import { Types } from 'mongoose';
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
} from '../../../../database/models';
import { ProductServiceError, productService } from '../product.service';
import type { CreateProductInput, UpdateProductInput } from '../product.types';

jest.mock('../../../../database/models', () => ({
  Brand: {
    find: jest.fn(),
    findById: jest.fn(),
  },
  Category: {
    find: jest.fn(),
    findById: jest.fn(),
  },
  Coupon: {
    countDocuments: jest.fn(),
  },
  Product: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    distinct: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
  Inventory: {
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
  },
  InventoryImport: {
    countDocuments: jest.fn(),
  },
  InventoryReservation: {
    countDocuments: jest.fn(),
  },
  Cart: {
    countDocuments: jest.fn(),
  },
  Order: {
    countDocuments: jest.fn(),
  },
  Favorite: {
    countDocuments: jest.fn(),
  },
}));

const mockedBrand = Brand as jest.Mocked<typeof Brand>;
const mockedCart = Cart as jest.Mocked<typeof Cart>;
const mockedCategory = Category as jest.Mocked<typeof Category>;
const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedFavorite = Favorite as jest.Mocked<typeof Favorite>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedInventoryImport = InventoryImport as jest.Mocked<typeof InventoryImport>;
const mockedInventoryReservation = InventoryReservation as jest.Mocked<typeof InventoryReservation>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedProduct = Product as jest.Mocked<typeof Product>;

const brandId = '665000000000000000000001';
const categoryId = '665000000000000000000002';
const productId = '665000000000000000000003';
const productImageUrl = 'https://res.cloudinary.com/demo/image/upload/v1/products/product.png';
const colorImageUrl = 'https://res.cloudinary.com/demo/image/upload/v1/products/color.png';

const createProductInput: CreateProductInput = {
  category_id: categoryId,
  name: ' Basic T-shirt ',
  brand_id: brandId,
  variant: [
    {
      fitTypeId: '665000000000000000000010',
      price: 199000,
      discount: 0,
      sizeMeasurements: [
        {
          size: 'M',
          measurements: [
            { key: 'shoulder', value: 42 },
            { key: 'chest', value: 96 },
            { key: 'length', value: 68 },
          ],
        },
      ],
      colors: [
        {
          color: ' Black ',
          colorCode: '#000000',
          image: ` ${colorImageUrl} `,
        },
      ],
    },
  ],
  description: ' A basic t-shirt for daily wear ',
  product_image: ` ${productImageUrl} `,
};

describe('productService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBrand.findById.mockResolvedValue({ _id: brandId } as never);
    mockedCategory.findById.mockResolvedValue({
      _id: categoryId,
      isSizeTemplateSource: true,
      sizes: ['M'],
      measurementFields: [
        { key: 'shoulder', label: 'Vai', unit: 'cm', required: true, sortOrder: 1 },
        { key: 'chest', label: 'Ng?c', unit: 'cm', required: true, sortOrder: 2 },
        { key: 'length', label: 'D?i ?o', unit: 'cm', required: true, sortOrder: 3 },
      ],
      fitTypes: [
        {
          _id: new Types.ObjectId('665000000000000000000010'),
          key: 'regular',
          label: 'Regular',
          sortOrder: 1,
          isActive: true,
        },
      ],
    } as never);
    mockedProduct.findOne.mockResolvedValue(null);
    mockedBrand.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    } as never);
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    } as never);
    mockedProduct.countDocuments.mockResolvedValue(0);
    mockedProduct.distinct.mockResolvedValue([]);
    mockedInventory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    } as never);
    mockedInventory.countDocuments.mockResolvedValue(0);
    mockedInventoryImport.countDocuments.mockResolvedValue(0);
    mockedInventoryReservation.countDocuments.mockResolvedValue(0);
    mockedCart.countDocuments.mockResolvedValue(0);
    mockedOrder.countDocuments.mockResolvedValue(0);
    mockedFavorite.countDocuments.mockResolvedValue(0);
    mockedCoupon.countDocuments.mockResolvedValue(0);
  });

  it('creates a product with normalized object ids and variant data', async () => {
    const product = { _id: productId, name: 'Basic T-shirt' };
    mockedProduct.create.mockResolvedValue(product as never);

    const result = await productService.createProduct(createProductInput);

    expect(mockedBrand.findById).toHaveBeenCalledWith(brandId);
    expect(mockedCategory.findById).toHaveBeenCalledWith(categoryId);
    expect(mockedProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Basic T-shirt',
        description: 'A basic t-shirt for daily wear',
        product_image: productImageUrl,
        isActive: true,
        variant: [
          expect.objectContaining({
            fitTypeId: expect.any(Object),
            price: 199000,
            discount: 0,
            isActive: true,
            colors: [
              expect.objectContaining({
                color: 'Black',
                colorCode: '#000000',
                image: colorImageUrl,
              }),
            ],
          }),
        ],
      }),
    );
    expect(result).toBe(product);
  });

  it('throws 404 when brand does not exist', async () => {
    mockedBrand.findById.mockResolvedValue(null);

    await expect(productService.createProduct(createProductInput)).rejects.toMatchObject({
      message: 'Brand not found',
      statusCode: 404,
    });
  });

  it('throws 404 when category does not exist', async () => {
    mockedCategory.findById.mockResolvedValue(null);

    await expect(productService.createProduct(createProductInput)).rejects.toMatchObject({
      message: 'Category not found',
      statusCode: 404,
    });
  });

  it('falls back to the parent size template when a category template source pointer is stale', async () => {
    const staleSourceId = '665000000000000000000020';
    const parentCategoryId = '665000000000000000000021';
    const product = { _id: productId, name: 'Basic T-shirt' };

    mockedCategory.findById
      .mockResolvedValueOnce({ _id: categoryId, isActive: true } as never)
      .mockResolvedValueOnce({
        _id: categoryId,
        isActive: true,
        isSizeTemplateSource: false,
        sizeTemplateSourceId: new Types.ObjectId(staleSourceId),
        parent_id: new Types.ObjectId(parentCategoryId),
      } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: parentCategoryId,
        isSizeTemplateSource: true,
        sizes: ['M'],
        measurementFields: [
          { key: 'shoulder', label: 'Shoulder', unit: 'cm', required: true, sortOrder: 1 },
          { key: 'chest', label: 'Chest', unit: 'cm', required: true, sortOrder: 2 },
          { key: 'length', label: 'Length', unit: 'cm', required: true, sortOrder: 3 },
        ],
        fitTypes: [
          {
            _id: new Types.ObjectId('665000000000000000000010'),
            key: 'regular',
            label: 'Regular',
            sortOrder: 1,
            isActive: true,
          },
        ],
      } as never);
    mockedProduct.create.mockResolvedValue(product as never);

    const result = await productService.createProduct(createProductInput);

    expect(mockedProduct.create).toHaveBeenCalled();
    expect(result).toBe(product);
  });

  it('throws 400 when brand is inactive', async () => {
    mockedBrand.findById.mockResolvedValue({ _id: brandId, isActive: false } as never);

    await expect(productService.createProduct(createProductInput)).rejects.toMatchObject({
      message: 'Brand is inactive',
      statusCode: 400,
    });
  });

  it('throws 400 when category is inactive', async () => {
    mockedCategory.findById.mockResolvedValue({ _id: categoryId, isActive: false } as never);

    await expect(productService.createProduct(createProductInput)).rejects.toMatchObject({
      message: 'Category is inactive',
      statusCode: 400,
    });
  });

  it('throws 400 when product image URL is not a whitelisted Cloudinary host', async () => {
    await expect(
      productService.createProduct({
        ...createProductInput,
        product_image: 'https://example.com/product.png',
      }),
    ).rejects.toMatchObject({
      message: 'Image URL host is not allowed',
      statusCode: 400,
    });
  });

  it('throws 400 when variant color image URL is not a whitelisted Cloudinary host', async () => {
    await expect(
      productService.createProduct({
        ...createProductInput,
        variant: [
          {
            ...createProductInput.variant![0],
            colors: [
              {
                ...createProductInput.variant![0].colors[0],
                image: 'https://example.com/color.png',
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Image URL host is not allowed',
      statusCode: 400,
    });
  });

  it('throws 400 when product id is invalid', async () => {
    await expect(productService.updateProduct('invalid-id', { name: 'Updated' })).rejects.toMatchObject({
      message: 'Invalid product id',
      statusCode: 400,
    });
  });

  it('throws 400 when variant payload contains duplicate fitTypeId', async () => {
    await expect(
      productService.createProduct({
        ...createProductInput,
        variant: [
          createProductInput.variant![0],
          {
            ...createProductInput.variant![0],
            fitTypeId: '665000000000000000000010',
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Duplicate fitTypeId in product variants',
      statusCode: 400,
    });
  });

  it('throws 400 when variant fitTypeId is not valid for the category', async () => {
    await expect(
      productService.createProduct({
        ...createProductInput,
        variant: [
          {
            ...createProductInput.variant![0],
            fitTypeId: '665000000000000000000011',
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Variant fitTypeId is not valid for this category',
      statusCode: 400,
    });
  });

  it('creates a product when payload is valid and no duplicate variants exist', async () => {
    const product = { _id: productId, name: 'Basic T-shirt' };
    mockedProduct.create.mockResolvedValue(product as never);

    const result = await productService.createProduct(createProductInput);

    expect(result).toBe(product);
  });

  it('updates a product after checking references and variant payload', async () => {
    const product = { _id: productId, name: 'Old product' };
    const updatedProduct = { _id: productId, name: 'Updated product' };
    mockedProduct.findById.mockResolvedValue(product as never);
    mockedProduct.findByIdAndUpdate.mockResolvedValue(updatedProduct as never);

    const result = await productService.updateProduct(productId, {
      name: ' Updated product ',
      brand_id: brandId,
      category_id: categoryId,
      variant: createProductInput.variant,
    });

    expect(mockedProduct.findByIdAndUpdate).toHaveBeenCalledWith(
      productId,
      expect.objectContaining({
        name: 'Updated product',
      }),
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(result).toBe(updatedProduct);
  });

  it('does not let product updates override system-owned rating metrics', async () => {
    const product = { _id: productId, name: 'Old product' };
    const updatedProduct = { _id: productId, name: 'Updated product' };
    mockedProduct.findById.mockResolvedValue(product as never);
    mockedProduct.findByIdAndUpdate.mockResolvedValue(updatedProduct as never);

    const unsafeInput = {
      name: ' Updated product ',
      averageRating: 5,
      reviewCount: 999,
    } as unknown as UpdateProductInput;

    const result = await productService.updateProduct(productId, unsafeInput);

    expect(mockedProduct.findByIdAndUpdate).toHaveBeenCalledWith(
      productId,
      {
        name: 'Updated product',
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(result).toBe(updatedProduct);
  });

  it('soft deletes a product by setting isActive to false', async () => {
    const product = { _id: productId, isActive: false };
    mockedProduct.findByIdAndUpdate.mockResolvedValue(product as never);

    const result = await productService.deleteProduct(productId);

    expect(mockedProduct.findByIdAndUpdate).toHaveBeenCalledWith(
      productId,
      { isActive: false },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
    expect(result).toBe(product);
  });

  it('permanently deletes a product only when it has no business records', async () => {
    const product = {
      _id: productId,
      category_id: categoryId,
      isActive: false,
      sold_quantity: 0,
      reviewCount: 0,
    };
    mockedProduct.findById.mockResolvedValue(product as never);
    mockedProduct.findByIdAndDelete.mockResolvedValue(product as never);

    const result = await productService.permanentlyDeleteProduct(productId);

    expect(mockedInventory.deleteMany).toHaveBeenCalledWith({
      productId: new Types.ObjectId(productId),
    });
    expect(mockedProduct.findByIdAndDelete).toHaveBeenCalledWith(productId);
    expect(result).toBe(product);
  });

  it('prevents permanent deletion when product has business records', async () => {
    mockedProduct.findById.mockResolvedValue({
      _id: productId,
      category_id: categoryId,
      sold_quantity: 0,
      reviewCount: 0,
    } as never);
    mockedInventory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { quantity: 1, reservedQuantity: 0, availableQuantity: 1 },
      ]),
    } as never);

    await expect(productService.permanentlyDeleteProduct(productId)).rejects.toMatchObject({
      message: 'Chưa thể xóa vĩnh viễn sản phẩm này vì vẫn còn tồn kho hoặc hàng đang được giữ. Hãy xử lý tồn kho trước, hoặc chọn ngừng bán để ẩn sản phẩm.',
      statusCode: 409,
    });
    expect(mockedProduct.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('prevents permanent deletion when product is in an active coupon', async () => {
    mockedProduct.findById.mockResolvedValue({
      _id: productId,
      category_id: categoryId,
      sold_quantity: 0,
      reviewCount: 0,
    } as never);
    mockedCoupon.countDocuments.mockResolvedValue(1);

    await expect(productService.permanentlyDeleteProduct(productId)).rejects.toMatchObject({
      message: 'Chưa thể xóa vĩnh viễn sản phẩm này vì đang được dùng trong khuyến mãi còn hiệu lực.',
      statusCode: 409,
    });
    expect(mockedProduct.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('maps products and inventory into the admin management hierarchy', async () => {
    const fitTypeId = new Types.ObjectId('665000000000000000000010');
    const variantId = new Types.ObjectId('665000000000000000000011');
    const colorId = new Types.ObjectId('665000000000000000000012');
    mockedProduct.aggregate.mockResolvedValue([
        {
          _id: new Types.ObjectId(productId),
          category: {
            _id: new Types.ObjectId(categoryId),
            name: 'T-shirts',
          },
          templateCategory: {
            _id: new Types.ObjectId(categoryId),
            name: 'T-shirts',
            fitTypes: [
              {
                _id: fitTypeId,
                key: 'regular',
                label: 'Regular',
                sortOrder: 1,
                isActive: true,
              },
            ],
          },
          name: 'Basic T-shirt',
          brand: { _id: new Types.ObjectId(brandId), name: 'YODY' },
          variant: [
            {
              _id: variantId,
              fitTypeId,
              price: 200000,
              discount: 0,
              sizeMeasurements: [{ size: 'M', measurements: [] }],
              colors: [
                {
                  _id: colorId,
                  color: 'Black',
                  colorCode: '#000000',
                  image: 'https://example.com/black.png',
                },
              ],
              isActive: true,
            },
          ],
          product_image: 'https://example.com/product.png',
          isActive: true,
          sold_quantity: 12,
          inventoryItems: [
            {
              productId: new Types.ObjectId(productId),
              variantId,
              colorVariantId: colorId,
              size: 'M',
              sku: 'TEE-REG-BLK-M',
              availableQuantity: 4,
            },
          ],
        },
      ] as never);

    const result = await productService.getManagementProducts();

    expect(result).toEqual([
      expect.objectContaining({
        _id: productId,
        name: 'Basic T-shirt',
        brandName: 'YODY',
        categoryName: 'T-shirts',
        soldQuantity: 12,
        variants: [
          expect.objectContaining({
            _id: variantId.toString(),
            fitTypeLabel: 'Regular',
            colors: [
              expect.objectContaining({
                _id: colorId.toString(),
                inventory: [
                  {
                    size: 'M',
                    sku: 'TEE-REG-BLK-M',
                    availableQuantity: 4,
                  },
                ],
              }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('maps product detail into a public catalog DTO', async () => {
    const fitTypeId = new Types.ObjectId('665000000000000000000010');
    const variantId = new Types.ObjectId('665000000000000000000011');
    const colorId = new Types.ObjectId('665000000000000000000012');
    const purpleColorId = new Types.ObjectId('665000000000000000000013');
    const productImage = 'https://example.com/product.png';
    const colorImage = 'https://example.com/black.png';
    const purpleImage = 'https://example.com/purple.png';
    const productDetailQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(productId),
        category_id: {
          _id: new Types.ObjectId(categoryId),
          name: 'T-shirts',
          gender: 'male',
          parent_id: null,
          level: 2,
          image: 'https://example.com/category.png',
          isSizeTemplateSource: true,
          sizeTemplateSourceId: null,
          sizes: ['M'],
          measurementFields: [
            { key: 'shoulder', label: 'Vai', unit: 'cm', required: true, sortOrder: 1 },
            { key: 'chest', label: 'Nguc', unit: 'cm', required: true, sortOrder: 2 },
          ],
          fitTypes: [
            {
              _id: fitTypeId,
              key: 'regular',
              label: 'Regular',
              sortOrder: 1,
              isActive: true,
            },
          ],
        },
        name: 'Basic T-shirt',
        brand_id: {
          _id: new Types.ObjectId(brandId),
          name: 'YODY',
          image: 'https://example.com/brand.png',
        },
        variant: [
          {
            _id: variantId,
            fitTypeId,
            price: 200000,
            discount: 10,
            sizeMeasurements: [
              {
                size: 'M',
                measurements: [
                  { key: 'shoulder', value: 42 },
                  { key: 'chest', value: 96 },
                ],
              },
            ],
            colors: [
              {
                _id: colorId,
                color: 'Black',
                colorCode: 'DEN',
                image: colorImage,
              },
              {
                _id: purpleColorId,
                color: 'Tím than',
                colorCode: 'TIT',
                image: purpleImage,
              },
            ],
            isActive: true,
          },
        ],
        description: 'A basic t-shirt for daily wear',
        product_image: productImage,
        isActive: true,
        sold_quantity: 12,
        averageRating: 5,
        reviewCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    mockedProduct.findOne.mockReturnValue(productDetailQuery as never);
    mockedInventory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          productId: new Types.ObjectId(productId),
          variantId,
          colorVariantId: colorId,
          size: 'M',
          sku: 'INV-000003-000011-000012-M',
          quantity: 12,
          reservedQuantity: 0,
          availableQuantity: 12,
        },
      ]),
    } as never);

    const result = await productService.getProductDetailById(productId);

    expect(mockedProduct.findOne).toHaveBeenCalledWith({ _id: productId, isActive: true });
    expect(productDetailQuery.populate).toHaveBeenCalledWith('brand_id', '_id name image');
    expect(productDetailQuery.populate).toHaveBeenCalledWith(
      'category_id',
      '_id name gender parent_id level image isSizeTemplateSource sizeTemplateSourceId sizes measurementFields fitTypes',
    );
    expect(result).toMatchObject({
      _id: productId,
      name: 'Basic T-shirt',
      productImage,
      gallery: [productImage, colorImage, purpleImage],
      originalPrice: 200000,
      discount: 10,
      finalPrice: 180000,
      isSale: true,
      isAvailable: true,
      soldQuantity: 12,
      averageRating: 5,
      reviewCount: 3,
      brand: {
        _id: brandId,
        name: 'YODY',
      },
      category: {
        _id: categoryId,
        name: 'T-shirts',
        gender: 'male',
      },
      categoryBreadcrumb: [
        {
          _id: categoryId,
          name: 'T-shirts',
          gender: 'male',
          parent_id: null,
          level: 2,
        },
      ],
      selectedVariantId: variantId.toString(),
      colors: [
        {
          _id: colorId.toString(),
          color: 'Black',
          colorCode: '#111111',
          image: colorImage,
        },
        {
          _id: purpleColorId.toString(),
          color: 'Tím than',
          colorCode: '#000080',
          image: purpleImage,
        },
      ],
      sizes: ['M'],
    });
    expect(result.variants[0]).toMatchObject({
      _id: variantId.toString(),
      fitTypeId: fitTypeId.toString(),
      fitType: {
        _id: fitTypeId.toString(),
        key: 'regular',
        label: 'Regular',
      },
      sizes: [
        {
          size: 'M',
          isAvailable: true,
          availableQuantity: 12,
          measurements: [
            { key: 'shoulder', label: 'Vai', unit: 'cm', value: 42 },
            { key: 'chest', label: 'Nguc', unit: 'cm', value: 96 },
          ],
        },
      ],
      inventory: [
        {
          colorVariantId: colorId.toString(),
          size: 'M',
          sku: 'INV-000003-000011-000012-M',
          availableQuantity: 12,
          isAvailable: true,
        },
      ],
    });
    expect(result.ratingSummary.distribution).toHaveLength(5);
    expect(result.policies).toHaveLength(3);
  });

  it('keeps active products visible in the public list even when inventory is empty', async () => {
    const fitTypeId = new Types.ObjectId('665000000000000000000010');
    const variantId = new Types.ObjectId('665000000000000000000011');
    const colorId = new Types.ObjectId('665000000000000000000012');
    const productDocument = {
      _id: new Types.ObjectId(productId),
      category_id: {
        _id: new Types.ObjectId(categoryId),
        name: 'T-shirts',
        gender: 'male',
        image: null,
      },
      name: 'Basic T-shirt',
      brand_id: {
        _id: new Types.ObjectId(brandId),
        name: 'YODY',
        image: null,
      },
      variant: [
        {
          _id: variantId,
          fitTypeId,
          price: 200000,
          discount: 0,
          sizeMeasurements: [{ size: 'M', measurements: [] }],
          colors: [
            {
              _id: colorId,
              color: 'Black',
              colorCode: 'DEN',
              image: 'https://example.com/black.png',
            },
          ],
          isActive: true,
        },
      ],
      product_image: 'https://example.com/product.png',
      isActive: true,
      sold_quantity: 12,
      averageRating: 5,
      reviewCount: 3,
      createdAt: new Date(),
    };
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([productDocument]),
    };

    mockedProduct.find.mockReturnValue(productListQuery as never);
    mockedProduct.countDocuments.mockResolvedValue(1);
    mockedInventory.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    } as never);

    const result = await productService.getProductList({ page: 1, limit: 10 });
    const productFilter = mockedProduct.find.mock.calls[0][0] as unknown as Record<string, unknown>;

    expect(productFilter).not.toHaveProperty('_id');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      _id: productId,
      name: 'Basic T-shirt',
      isAvailable: false,
      brand: {
        _id: brandId,
        name: 'YODY',
      },
      category: {
        _id: categoryId,
        name: 'T-shirts',
      },
    });
  });

  it('sorts the public product list by discounted final price', async () => {
    const regularProductId = new Types.ObjectId('665000000000000000000030');
    const discountedProductId = new Types.ObjectId('665000000000000000000031');
    const fitTypeId = new Types.ObjectId('665000000000000000000010');
    const createListProduct = (
      id: Types.ObjectId,
      name: string,
      price: number,
      discount: number,
    ) => ({
      _id: id,
      category_id: { _id: new Types.ObjectId(categoryId), name: 'T-shirts', gender: 'male' },
      name,
      brand_id: { _id: new Types.ObjectId(brandId), name: 'YODY' },
      variant: [{
        _id: new Types.ObjectId(),
        fitTypeId,
        price,
        discount,
        sizeMeasurements: [{ size: 'M', measurements: [] }],
        colors: [{ _id: new Types.ObjectId(), color: 'Black', image: colorImageUrl }],
        isActive: true,
      }],
      description: '',
      product_image: productImageUrl,
      isActive: true,
      sold_quantity: 0,
      averageRating: 0,
      reviewCount: 0,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    const regularProduct = createListProduct(regularProductId, 'Regular price', 50000, 0);
    const discountedProduct = createListProduct(discountedProductId, 'Discounted price', 100000, 60);
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([regularProduct, discountedProduct]),
    };

    mockedProduct.aggregate.mockResolvedValue([
      { _id: discountedProductId },
      { _id: regularProductId },
    ] as never);
    mockedProduct.find.mockReturnValue(productListQuery as never);
    mockedProduct.countDocuments.mockResolvedValue(2);
    mockedInventory.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) } as never);

    const result = await productService.getProductList({
      sort: 'price_asc',
      page: 1,
      limit: 10,
      includeFilters: false,
    });
    const aggregatePipeline = mockedProduct.aggregate.mock.calls[0][0] as unknown as Array<Record<string, unknown>>;

    expect(aggregatePipeline).toEqual(expect.arrayContaining([
      { $sort: { __catalogFinalPrice: 1, createdAt: -1 } },
    ]));
    expect(mockedProduct.find).toHaveBeenCalledWith({
      _id: { $in: [discountedProductId, regularProductId] },
    });
    expect(result.items.map((item) => item.finalPrice)).toEqual([40000, 50000]);
  });

  it('only applies matched category ids to their corresponding keyword groups', async () => {
    const matchedCategoryId = new Types.ObjectId(categoryId);
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };

    mockedBrand.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    } as never);
    mockedCategory.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: matchedCategoryId, name: 'Áo polo' }]),
    } as never);
    mockedProduct.find.mockReturnValue(productListQuery as never);

    await productService.getProductList({
      keyword: 'áo polo mềm',
      includeFilters: false,
    });
    const filter = mockedProduct.find.mock.calls[0][0] as unknown as {
      $and: Array<{ $or: Array<Record<string, unknown>> }>;
    };
    const categoryRelationPresence = filter.$and.map((condition) => {
      return condition.$or.some((item) => Object.prototype.hasOwnProperty.call(item, 'category_id'));
    });

    expect(mockedCategory.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    expect(categoryRelationPresence).toEqual([true, true, false]);
  });

  it('matches material aliases as complete words instead of unrelated substrings', async () => {
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    mockedProduct.find.mockReturnValue(productListQuery as never);

    await productService.getProductList({ keyword: 'leather', includeFilters: false });
    const leatherFilter = mockedProduct.find.mock.calls[0][0] as unknown as {
      $and: Array<{ $or: Array<{ description?: RegExp }> }>;
    };
    const leatherRegexes = leatherFilter.$and[0].$or
      .map((condition) => condition.description)
      .filter((regex): regex is RegExp => regex instanceof RegExp);

    expect(leatherRegexes.some((regex) => regex.test('Chất liệu da saffiano mềm mại'))).toBe(true);
    expect(leatherRegexes.some((regex) => regex.test('Áo có dáng suông dài'))).toBe(false);
    expect(leatherRegexes.some((regex) => regex.test('Không gây kích ứng lên da nhạy cảm'))).toBe(false);
    expect(leatherRegexes.some((regex) => regex.test(
      'Chất liệu viscose co giãn, giữ ấm và không gây kích ứng lên da nhạy cảm',
    ))).toBe(false);

    await productService.getProductList({ keyword: 'wool', includeFilters: false });
    const woolFilter = mockedProduct.find.mock.calls[1][0] as unknown as {
      $and: Array<{ $or: Array<{ description?: RegExp }> }>;
    };
    const woolRegexes = woolFilter.$and[0].$or
      .map((condition) => condition.description)
      .filter((regex): regex is RegExp => regex instanceof RegExp);

    expect(woolRegexes.some((regex) => regex.test('Áo len mềm mại'))).toBe(true);
    expect(woolRegexes.some((regex) => regex.test('Lên đồ thanh lịch'))).toBe(false);
  });

  it('filters variants by discounted final price instead of the original price', async () => {
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    mockedProduct.find.mockReturnValue(productListQuery as never);

    await productService.getProductList({
      minPrice: 40000,
      maxPrice: 45000,
      includeFilters: false,
    });
    const filter = mockedProduct.find.mock.calls[0][0] as unknown as {
      variant: { $elemMatch: Record<string, unknown> };
      $expr: Record<string, unknown>;
    };
    const priceExpression = JSON.stringify(filter.$expr);

    expect(filter.variant.$elemMatch).not.toHaveProperty('price');
    expect(priceExpression).toContain('"$round"');
    expect(priceExpression).toContain('40000');
    expect(priceExpression).toContain('45000');
  });

  it('keeps an out-of-stock variant that matches the requested final-price range', async () => {
    const listProductId = new Types.ObjectId('665000000000000000000040');
    const cheapVariantId = new Types.ObjectId('665000000000000000000041');
    const cheapColorId = new Types.ObjectId('665000000000000000000042');
    const availableVariantId = new Types.ObjectId('665000000000000000000043');
    const availableColorId = new Types.ObjectId('665000000000000000000044');
    const fitTypeId = new Types.ObjectId('665000000000000000000010');
    const productDocument = {
      _id: listProductId,
      category_id: { _id: new Types.ObjectId(categoryId), name: 'T-shirts', gender: 'male' },
      name: 'Two-price product',
      brand_id: { _id: new Types.ObjectId(brandId), name: 'YODY' },
      variant: [
        {
          _id: cheapVariantId,
          fitTypeId,
          price: 100000,
          discount: 60,
          sizeMeasurements: [{ size: 'M', measurements: [] }],
          colors: [{ _id: cheapColorId, color: 'Black', image: colorImageUrl }],
          isActive: true,
        },
        {
          _id: availableVariantId,
          fitTypeId,
          price: 50000,
          discount: 0,
          sizeMeasurements: [{ size: 'M', measurements: [] }],
          colors: [{ _id: availableColorId, color: 'Black', image: colorImageUrl }],
          isActive: true,
        },
      ],
      description: '',
      product_image: productImageUrl,
      isActive: true,
      sold_quantity: 0,
      averageRating: 0,
      reviewCount: 0,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    };
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([productDocument]),
    };
    mockedProduct.find.mockReturnValue(productListQuery as never);
    mockedProduct.countDocuments.mockResolvedValue(1);
    mockedInventory.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          productId: listProductId,
          variantId: cheapVariantId,
          colorVariantId: cheapColorId,
          size: 'M',
          availableQuantity: 0,
        },
        {
          productId: listProductId,
          variantId: availableVariantId,
          colorVariantId: availableColorId,
          size: 'M',
          availableQuantity: 10,
        },
      ]),
    } as never);

    const result = await productService.getProductList({
      maxPrice: 45000,
      includeFilters: false,
    });

    expect(result.items[0]).toMatchObject({
      finalPrice: 40000,
      originalPrice: 100000,
      isAvailable: false,
    });
  });

  it('returns an empty catalog result for a well-formed category id that no longer exists', async () => {
    const productListQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    mockedCategory.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as never);
    mockedProduct.find.mockReturnValue(productListQuery as never);

    const result = await productService.getProductList({
      categoryId: ['111111111111111111111111'],
      includeFilters: false,
    });
    const filter = mockedProduct.find.mock.calls[0][0] as unknown as {
      category_id: { $in: unknown[] };
    };

    expect(filter.category_id.$in).toEqual([]);
    expect(result.items).toEqual([]);
  });

  it('uses a typed service error for product failures', async () => {
    await expect(productService.getProductById('invalid-id')).rejects.toBeInstanceOf(
      ProductServiceError,
    );
  });
});
