import { Types } from 'mongoose';
import { Brand, Category, Product } from '../../../../database/models';
import { ProductServiceError, productService } from '../product.service';
import type { CreateProductInput } from '../product.types';

jest.mock('../../../../database/models', () => ({
  Brand: {
    findById: jest.fn(),
  },
  Category: {
    findById: jest.fn(),
  },
  Product: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

const mockedBrand = Brand as jest.Mocked<typeof Brand>;
const mockedCategory = Category as jest.Mocked<typeof Category>;
const mockedProduct = Product as jest.Mocked<typeof Product>;

const brandId = '665000000000000000000001';
const categoryId = '665000000000000000000002';
const productId = '665000000000000000000003';

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
          image: ' https://example.com/color.png ',
        },
      ],
    },
  ],
  description: ' A basic t-shirt for daily wear ',
  product_image: ' https://example.com/product.png ',
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
        product_image: 'https://example.com/product.png',
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
                image: 'https://example.com/color.png',
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
        new: true,
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
        new: true,
        runValidators: true,
      },
    );
    expect(result).toBe(product);
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
          bannerImage: null,
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

    const result = await productService.getProductDetailById(productId);

    expect(mockedProduct.findOne).toHaveBeenCalledWith({ _id: productId, isActive: true });
    expect(productDetailQuery.populate).toHaveBeenCalledWith('brand_id', '_id name image');
    expect(productDetailQuery.populate).toHaveBeenCalledWith(
      'category_id',
      '_id name gender parent_id level image bannerImage isSizeTemplateSource sizeTemplateSourceId sizes measurementFields fitTypes',
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
          measurements: [
            { key: 'shoulder', label: 'Vai', unit: 'cm', value: 42 },
            { key: 'chest', label: 'Nguc', unit: 'cm', value: 96 },
          ],
        },
      ],
    });
    expect(result.ratingSummary.distribution).toHaveLength(5);
    expect(result.policies).toHaveLength(3);
  });

  it('uses a typed service error for product failures', async () => {
    await expect(productService.getProductById('invalid-id')).rejects.toBeInstanceOf(
      ProductServiceError,
    );
  });
});
