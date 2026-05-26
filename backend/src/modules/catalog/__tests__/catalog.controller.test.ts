import type { Request, Response } from 'express';
import { createBrand, deleteBrand, updateBrand } from '../brands/brand.controller';
import { BrandServiceError, brandService } from '../brands/brand.service';
import { createCategory, getCategoryById } from '../categories/categories.controller';
import { categoryService } from '../categories/categories.service';
import { createProduct, updateProduct } from '../products/product.controller';
import { productService } from '../products/product.service';
import { uploadToCloudinary } from '../../../utils/cloudinary.util';

jest.mock('../brands/brand.service', () => {
  class BrandServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = 'BrandServiceError';
    }
  }

  return {
    BrandServiceError,
    brandService: {
      createBrand: jest.fn(),
      updateBrand: jest.fn(),
      deleteBrand: jest.fn(),
      getBrands: jest.fn(),
      getActiveBrands: jest.fn(),
    },
  };
});

jest.mock('../categories/categories.service', () => ({
  categoryService: {
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    getCategories: jest.fn(),
    getActiveCategories: jest.fn(),
    getCategoryById: jest.fn(),
  },
}));

jest.mock('../products/product.service', () => ({
  productService: {
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
    getProducts: jest.fn(),
    getActiveProducts: jest.fn(),
    getProductById: jest.fn(),
  },
}));

jest.mock('../../../utils/cloudinary.util', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
  extractPublicIdFromUrl: jest.fn((url: string) => url),
}));

const mockedBrandService = brandService as jest.Mocked<typeof brandService>;
const mockedCategoryService = categoryService as jest.Mocked<typeof categoryService>;
const mockedProductService = productService as jest.Mocked<typeof productService>;
const mockedUploadToCloudinary = uploadToCloudinary as jest.MockedFunction<typeof uploadToCloudinary>;

const createRequest = (
  body: unknown = {},
  params: Record<string, string> = {},
  files?: Record<string, Express.Multer.File[]>,
) => {
  return {
    body,
    params,
    files,
  } as Request;
};

const createResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('catalog controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('brands', () => {
    it('returns 400 when create brand payload is missing required fields', async () => {
      const req = createRequest({ name: 'Nike' });
      const res = createResponse();

      await createBrand(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Name and image are required' });
      expect(mockedBrandService.createBrand).not.toHaveBeenCalled();
    });

    it('creates a brand through brand service', async () => {
      const brand = { _id: 'brand-id', name: 'Nike', image: 'https://example.com/nike.png' };
      mockedBrandService.createBrand.mockResolvedValue(brand as never);

      const req = createRequest({ name: 'Nike', image: 'https://example.com/nike.png' });
      const res = createResponse();

      await createBrand(req, res);

      expect(mockedBrandService.createBrand).toHaveBeenCalledWith({
        name: 'Nike',
        image: 'https://example.com/nike.png',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: 'OK', data: brand });
    });

    it('returns 400 when update brand payload is empty', async () => {
      const req = createRequest({}, { id: 'brand-id' });
      const res = createResponse();

      await updateBrand(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No data to update' });
      expect(mockedBrandService.updateBrand).not.toHaveBeenCalled();
    });

    it('maps brand service errors to the response status code', async () => {
      mockedBrandService.deleteBrand.mockRejectedValue(new BrandServiceError('Brand not found', 404));

      const req = createRequest({}, { id: 'brand-id' });
      const res = createResponse();

      await deleteBrand(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Brand not found' });
    });
  });

  describe('categories', () => {
    it('returns 400 when create category payload is missing required fields', async () => {
      const req = createRequest({ name: 'Shirts' });
      const res = createResponse();

      await createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Name, level, gender, image, and description are required',
      });
      expect(mockedCategoryService.createCategory).not.toHaveBeenCalled();
    });

    it('gets a category by id through category service', async () => {
      const category = { _id: 'category-id', name: 'Shirts' };
      mockedCategoryService.getCategoryById.mockResolvedValue(category as never);

      const req = createRequest({}, { id: 'category-id' });
      const res = createResponse();

      await getCategoryById(req, res);

      expect(mockedCategoryService.getCategoryById).toHaveBeenCalledWith('category-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'OK', data: category });
    });
  });

  describe('products', () => {
    it('returns 400 when create product payload is missing required fields', async () => {
      const req = createRequest({ name: 'T-shirt' });
      const res = createResponse();

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Category, name, brand, and description are required',
      });
      expect(mockedProductService.createProduct).not.toHaveBeenCalled();
    });

    it('updates a product through product service', async () => {
      const product = { _id: 'product-id', name: 'Updated T-shirt' };
      mockedProductService.updateProduct.mockResolvedValue(product as never);

      const req = createRequest({ name: 'Updated T-shirt', isActive: true }, { id: 'product-id' });
      const res = createResponse();

      await updateProduct(req, res);

      expect(mockedProductService.updateProduct).toHaveBeenCalledWith('product-id', {
        name: 'Updated T-shirt',
        isActive: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'OK', data: product });
    });

    it('uploads product and version images before creating a product', async () => {
      const product = { _id: 'product-id', name: 'T-shirt' };
      mockedProductService.createProduct.mockResolvedValue(product as never);
      mockedUploadToCloudinary
        .mockResolvedValueOnce({
          secure_url: 'https://res.cloudinary.com/demo/products/product.png',
        } as never)
        .mockResolvedValueOnce({
          secure_url: 'https://res.cloudinary.com/demo/products/versions/black.png',
        } as never);

      const version = [
        {
          sku: 'TSHIRT-BLACK-M',
          color: 'Black',
          fitType: 'Regular',
          size_spec: [
            {
              size: 'M',
              shoulder: 42,
              chest: 96,
              length: 68,
              weight: 0.4,
            },
          ],
          version_image: 'https://example.com/fallback.png',
          price: 199000,
          discount: 0,
        },
      ];
      const req = createRequest(
        {
          category_id: '665000000000000000000001',
          name: 'T-shirt',
          brand_id: '665000000000000000000002',
          description: 'Basic product',
          version: JSON.stringify(version),
        },
        {},
        {
          product_image: [
            {
              buffer: Buffer.from('product-image'),
              originalname: 'product.png',
            } as Express.Multer.File,
          ],
          version_images: [
            {
              buffer: Buffer.from('version-image'),
              originalname: 'black.png',
            } as Express.Multer.File,
          ],
        },
      );
      const res = createResponse();

      await createProduct(req, res);

      expect(mockedUploadToCloudinary).toHaveBeenNthCalledWith(
        1,
        Buffer.from('product-image'),
        'product.png',
        'fashion-ecommerce/products',
      );
      expect(mockedUploadToCloudinary).toHaveBeenNthCalledWith(
        2,
        Buffer.from('version-image'),
        'black.png',
        'fashion-ecommerce/products/versions',
      );
      expect(mockedProductService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          product_image: 'https://res.cloudinary.com/demo/products/product.png',
          version: [
            expect.objectContaining({
              sku: 'TSHIRT-BLACK-M',
              version_image: 'https://res.cloudinary.com/demo/products/versions/black.png',
            }),
          ],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: 'OK', data: product });
    });
  });
});
