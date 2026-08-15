import type { Request, Response } from 'express';
import { createBrand, deleteBrand, updateBrand } from '../brands/brand.controller';
import { BrandServiceError, brandService } from '../brands/brand.service';
import { createCategory, getCategoryById } from '../categories/categories.controller';
import { categoryService } from '../categories/categories.service';
import { createProduct, getProductList, permanentlyDeleteProduct, updateProduct } from '../products/product.controller';
import { ProductServiceError, productService } from '../products/product.service';
import { deleteFromCloudinary, uploadToCloudinary } from '../../../utils/cloudinary.util';

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
      getBrandById: jest.fn(),
      getBrandsForManagement: jest.fn(),
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
    getCategoriesForManagement: jest.fn(),
    getActiveCategories: jest.fn(),
    getCategoryById: jest.fn(),
  },
}));

jest.mock('../products/product.service', () => {
  class ProductServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
      super(message);
      this.name = 'ProductServiceError';
    }
  }

  return {
    ProductServiceError,
    productService: {
      createProduct: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
      permanentlyDeleteProduct: jest.fn(),
      getProducts: jest.fn(),
      getManagementProducts: jest.fn(),
      getActiveProducts: jest.fn(),
      getProductList: jest.fn(),
      getProductById: jest.fn(),
      getProductDetailById: jest.fn(),
    },
  };
});

jest.mock('../../../utils/cloudinary.util', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
  extractPublicIdFromUrl: jest.fn((url: string) => url),
}));

const mockedBrandService = brandService as jest.Mocked<typeof brandService>;
const mockedCategoryService = categoryService as jest.Mocked<typeof categoryService>;
const mockedProductService = productService as jest.Mocked<typeof productService>;
const mockedUploadToCloudinary = uploadToCloudinary as jest.MockedFunction<typeof uploadToCloudinary>;
const mockedDeleteFromCloudinary = deleteFromCloudinary as jest.MockedFunction<typeof deleteFromCloudinary>;

const createRequest = (
  body: unknown = {},
  params: Record<string, string> = {},
  files?: Record<string, Express.Multer.File[]>,
  query: Record<string, unknown> = {},
) => {
  return {
    body,
    params,
    files,
    query,
    headers: {},
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
      expect(res.json).toHaveBeenCalledWith({ message: 'Created', data: brand });
    });

    it('uploads a brand logo before creating the brand', async () => {
      mockedUploadToCloudinary.mockResolvedValue({
        public_id: 'catalog/brand',
        secure_url: 'https://res.cloudinary.com/demo/brand.png',
        url: 'http://res.cloudinary.com/demo/brand.png',
        width: 100,
        height: 100,
        format: 'png',
        bytes: 100,
      });
      mockedBrandService.createBrand.mockResolvedValue({
        _id: 'brand-id',
      } as never);
      const imageFile = {
        buffer: Buffer.from('brand'),
        originalname: 'brand.png',
      } as Express.Multer.File;
      const req = createRequest({ name: 'Nike' });
      req.file = imageFile;
      const res = createResponse();

      await createBrand(req, res);

      expect(mockedUploadToCloudinary).toHaveBeenCalledWith(
        imageFile.buffer,
        'brand.png',
        'fashion-ecommerce/catalog/brands',
      );
      expect(mockedBrandService.createBrand).toHaveBeenCalledWith({
        name: 'Nike',
        image: 'https://res.cloudinary.com/demo/brand.png',
      });
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
        message: 'Name, gender, image, and description are required',
      });
      expect(mockedCategoryService.createCategory).not.toHaveBeenCalled();
    });

    it('uploads a category image before creating the category', async () => {
      mockedUploadToCloudinary.mockResolvedValue({
        public_id: 'catalog/category',
        secure_url: 'https://res.cloudinary.com/demo/category.png',
        url: 'http://res.cloudinary.com/demo/category.png',
        width: 100,
        height: 100,
        format: 'png',
        bytes: 100,
      });
      mockedCategoryService.createCategory.mockResolvedValue({
        _id: 'category-id',
      } as never);
      const imageFile = {
        buffer: Buffer.from('category'),
        originalname: 'category.png',
      } as Express.Multer.File;
      const req = createRequest(
        {
          name: 'Shirts',
          gender: 'male',
          description: 'Men shirts category',
        },
        {},
        { image: [imageFile] },
      );
      const res = createResponse();

      await createCategory(req, res);

      expect(mockedUploadToCloudinary).toHaveBeenCalledWith(
        imageFile.buffer,
        'category.png',
        'fashion-ecommerce/catalog/categories',
      );
      expect(mockedCategoryService.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          image: 'https://res.cloudinary.com/demo/category.png',
        }),
      );
    });

    it('gets a category by id through category service', async () => {
      const category = { _id: 'category-id', name: 'Shirts' };
      mockedCategoryService.getCategoryById.mockResolvedValue(category as never);

      const req = createRequest({}, { id: 'category-id' });
      const res = createResponse();

      await getCategoryById(req, res);

      expect(mockedCategoryService.getCategoryById).toHaveBeenCalledWith('category-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Success', data: category });
    });
  });

  describe('products', () => {
    it('parses public product list query into backend filter contract', async () => {
      const response = {
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
        filters: {
          brands: [],
          colors: [],
          fitTypes: [],
          sizes: [],
          categories: [],
        },
      };
      mockedProductService.getProductList.mockResolvedValue(response as never);

      const req = createRequest(
        {},
        {},
        undefined,
        {
          categoryId: ['665000000000000000000001', '665000000000000000000002'],
          brandId: '665000000000000000000003,665000000000000000000004',
          color: 'Đen,Trắng',
          fitTypeId: ['665000000000000000000005', '665000000000000000000006'],
          size: ['M', 'L'],
          gender: 'female',
          sort: 'newest',
        },
      );
      const res = createResponse();

      await getProductList(req, res);

      expect(mockedProductService.getProductList).toHaveBeenCalledWith({
        categoryId: ['665000000000000000000001', '665000000000000000000002'],
        brandId: ['665000000000000000000003', '665000000000000000000004'],
        color: ['Đen', 'Trắng'],
        fitType: ['665000000000000000000005', '665000000000000000000006'],
        size: ['M', 'L'],
        gender: 'female',
        sort: 'newest',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Success', data: response });
    });

    it('accepts relevance sort for keyword product searches', async () => {
      const response = {
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
      };
      mockedProductService.getProductList.mockResolvedValue(response as never);

      const req = createRequest(
        {},
        {},
        undefined,
        {
          keyword: 'quần kaki',
          sort: 'relevance',
        },
      );
      const res = createResponse();

      await getProductList(req, res);

      expect(mockedProductService.getProductList).toHaveBeenCalledWith({
        keyword: 'quần kaki',
        sort: 'relevance',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('hides unexpected product list errors from API responses', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockedProductService.getProductList.mockRejectedValue(new Error('database schema details') as never);
      const req = createRequest();
      const res = createResponse();

      await getProductList(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Product controller error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });

      consoleErrorSpy.mockRestore();
    });

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
      expect(res.json).toHaveBeenCalledWith({ message: 'Success', data: product });
    });

    it('uploads product image and creates a product with variant payload', async () => {
      const product = { _id: 'product-id', name: 'T-shirt' };
      mockedProductService.createProduct.mockResolvedValue(product as never);
      mockedUploadToCloudinary.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/products/product.png',
      } as never);

      const variant = [
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
              color: 'Black',
              colorCode: '#000000',
              image: 'https://example.com/black.png',
            },
          ],
        },
      ];

      const req = createRequest(
        {
          category_id: '665000000000000000000001',
          name: 'T-shirt',
          brand_id: '665000000000000000000002',
          description: 'Basic product',
          variant: JSON.stringify(variant),
        },
        {},
        {
          product_image: [
            {
              buffer: Buffer.from('product-image'),
              originalname: 'product.png',
            } as Express.Multer.File,
          ],
        },
      );
      const res = createResponse();

      await createProduct(req, res);

      expect(mockedUploadToCloudinary).toHaveBeenCalledWith(
        Buffer.from('product-image'),
        'product.png',
        'fashion-ecommerce/products',
      );
      expect(mockedProductService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          product_image: 'https://res.cloudinary.com/demo/products/product.png',
          variant: expect.arrayContaining([
            expect.objectContaining({
              fitTypeId: '665000000000000000000010',
              price: 199000,
            }),
          ]),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Created', data: product });
    });

    it('cleans up uploaded product images when product creation fails validation', async () => {
      mockedUploadToCloudinary.mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/demo/products/product.png',
      } as never);
      mockedProductService.createProduct.mockRejectedValue(
        new ProductServiceError('Brand is inactive', 400),
      );

      const req = createRequest(
        {
          category_id: '665000000000000000000001',
          name: 'T-shirt',
          brand_id: '665000000000000000000002',
          description: 'Basic product',
          variant: JSON.stringify([
            {
              fitTypeId: '665000000000000000000010',
              price: 199000,
              discount: 0,
              sizeMeasurements: [{ size: 'M', measurements: [] }],
              colors: [
                {
                  color: 'Black',
                  image: 'https://res.cloudinary.com/demo/products/black.png',
                },
              ],
            },
          ]),
        },
        {},
        {
          product_image: [
            {
              buffer: Buffer.from('product-image'),
              originalname: 'product.png',
            } as Express.Multer.File,
          ],
        },
      );
      const res = createResponse();

      await createProduct(req, res);

      expect(mockedDeleteFromCloudinary).toHaveBeenCalledWith(
        'https://res.cloudinary.com/demo/products/product.png',
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Brand is inactive' });
    });

    it('uploads variant color images before creating a product', async () => {
      const product = { _id: 'product-id', name: 'T-shirt' };
      mockedProductService.createProduct.mockResolvedValue(product as never);
      mockedUploadToCloudinary
        .mockResolvedValueOnce({
          secure_url: 'https://res.cloudinary.com/demo/products/product.png',
        } as never)
        .mockResolvedValueOnce({
          secure_url: 'https://res.cloudinary.com/demo/products/black.png',
        } as never);

      const req = createRequest(
        {
          category_id: '665000000000000000000001',
          name: 'T-shirt',
          brand_id: '665000000000000000000002',
          description: 'Basic product',
          variant: JSON.stringify([
            {
              fitTypeId: '665000000000000000000010',
              price: 199000,
              discount: 0,
              sizeMeasurements: [
                {
                  size: 'M',
                  measurements: [
                    { key: 'shoulder', value: 42 },
                  ],
                },
              ],
              colors: [
                {
                  color: 'Black',
                  image: '',
                },
              ],
            },
          ]),
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
        2,
        Buffer.from('version-image'),
        'black.png',
        'fashion-ecommerce/products',
      );
      expect(mockedProductService.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: [
            expect.objectContaining({
              colors: [
                expect.objectContaining({
                  color: 'Black',
                  image: 'https://res.cloudinary.com/demo/products/black.png',
                }),
              ],
            }),
          ],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Created', data: product });
    });

    it('returns 400 when uploaded variant image count does not match colors', async () => {
      const req = createRequest(
        {
          category_id: '665000000000000000000001',
          name: 'T-shirt',
          brand_id: '665000000000000000000002',
          description: 'Basic product',
          product_image: 'https://example.com/product.png',
          variant: JSON.stringify([
            {
              fitTypeId: '665000000000000000000010',
              price: 199000,
              discount: 0,
              sizeMeasurements: [
                {
                  size: 'M',
                  measurements: [
                    { key: 'shoulder', value: 42 },
                  ],
                },
              ],
              colors: [
                { color: 'Black', image: '' },
                { color: 'White', image: '' },
              ],
            },
          ]),
        },
        {},
        {
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

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Each product color must have exactly one uploaded image',
      });
      expect(mockedProductService.createProduct).not.toHaveBeenCalled();
    });

    it('permanently deletes a product through the product service', async () => {
      const product = {
        _id: '665000000000000000000003',
        product_image: 'https://example.com/product.png',
        variant: [],
      };
      mockedProductService.getProductById.mockResolvedValue(product as never);
      mockedProductService.permanentlyDeleteProduct.mockResolvedValue(product as never);
      const req = createRequest({}, { id: '665000000000000000000003' });
      const res = createResponse();

      await permanentlyDeleteProduct(req, res);

      expect(mockedProductService.permanentlyDeleteProduct).toHaveBeenCalledWith('665000000000000000000003');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
