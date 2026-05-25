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
  version: [
    {
      sku: ' TSHIRT-BLACK-M ',
      color: ' Black ',
      fitType: ' Regular ',
      size_spec: [
        {
          size: 'M',
          shoulder: 42,
          chest: 96,
          length: 68,
          weight: 0.4,
          stock_quantity: 10,
        },
      ],
      version_image: ' https://example.com/version.png ',
      price: 199000,
      discount: 0,
    },
  ],
  description: ' A basic t-shirt for daily wear ',
  product_image: ' https://example.com/product.png ',
};

describe('productService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBrand.findById.mockResolvedValue({ _id: brandId } as never);
    mockedCategory.findById.mockResolvedValue({ _id: categoryId } as never);
    mockedProduct.findOne.mockResolvedValue(null);
  });

  it('creates a product with normalized object ids and version data', async () => {
    const product = { _id: productId, name: 'Basic T-shirt' };
    mockedProduct.create.mockResolvedValue(product as never);

    const result = await productService.createProduct(createProductInput);

    expect(mockedBrand.findById).toHaveBeenCalledWith(brandId);
    expect(mockedCategory.findById).toHaveBeenCalledWith(categoryId);
    expect(mockedProduct.findOne).toHaveBeenCalledWith({
      _id: { $exists: true },
      'version.sku': { $in: ['TSHIRT-BLACK-M'] },
    });
    expect(mockedProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Basic T-shirt',
        description: 'A basic t-shirt for daily wear',
        product_image: 'https://example.com/product.png',
        isActive: true,
        version: [
          expect.objectContaining({
            sku: 'TSHIRT-BLACK-M',
            color: 'Black',
            fitType: 'Regular',
            version_image: 'https://example.com/version.png',
            image_embedding: [],
            isAvailable: true,
            import: [],
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

  it('throws 400 when version payload contains duplicate SKUs', async () => {
    await expect(
      productService.createProduct({
        ...createProductInput,
        version: [
          createProductInput.version![0],
          {
            ...createProductInput.version![0],
            sku: 'tshirt-black-m',
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Duplicate SKU in product versions',
      statusCode: 400,
    });
  });

  it('throws 409 when SKU already exists in another product', async () => {
    mockedProduct.findOne.mockResolvedValue({ _id: 'other-product-id' } as never);

    await expect(productService.createProduct(createProductInput)).rejects.toMatchObject({
      message: 'SKU already exists',
      statusCode: 409,
    });
  });

  it('updates a product after checking references and SKU uniqueness', async () => {
    const product = { _id: productId, name: 'Old product' };
    const updatedProduct = { _id: productId, name: 'Updated product' };
    mockedProduct.findById.mockResolvedValue(product as never);
    mockedProduct.findByIdAndUpdate.mockResolvedValue(updatedProduct as never);

    const result = await productService.updateProduct(productId, {
      name: ' Updated product ',
      brand_id: brandId,
      category_id: categoryId,
      version: createProductInput.version,
    });

    expect(mockedProduct.findOne).toHaveBeenCalledWith({
      _id: { $ne: productId },
      'version.sku': { $in: ['TSHIRT-BLACK-M'] },
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

  it('uses a typed service error for product failures', async () => {
    await expect(productService.getProductById('invalid-id')).rejects.toBeInstanceOf(
      ProductServiceError,
    );
  });
});
