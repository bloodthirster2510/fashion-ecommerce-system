import type { Request, Response } from 'express';
import { ProductServiceError, productService } from './product.service';
import type { CreateProductInput, ProductVersionInput, UpdateProductInput } from './product.types';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../../../utils/cloudinary.util';
import { handleMulterError, type MulterRequest } from '../../../middlewares/upload.middleware';
import type { IProductVersion } from '../../../database/models/product.model';

const getErrorResponse = (e: unknown) => {
  if (e instanceof ProductServiceError) {
    return {
      statusCode: e.statusCode,
      message: e.message,
    };
  }

  return {
    statusCode: 500,
    message: e instanceof Error ? e.message : 'An error occurred',
  };
};

const getUploadedFiles = (req: Request, fieldName: string) => {
  if (!req.files || Array.isArray(req.files)) {
    return [];
  }

  return req.files[fieldName] ?? [];
};

const parseVersions = (value: unknown): ProductVersionInput[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value as ProductVersionInput[];
  }

  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      throw new ProductServiceError('Version must be an array', 400);
    }

    return parsed as ProductVersionInput[];
  }

  throw new ProductServiceError('Version must be an array or JSON string', 400);
};

const uploadProductImage = async (file: Express.Multer.File) => {
  const uploadResult = await uploadToCloudinary(
    file.buffer,
    file.originalname,
    'fashion-ecommerce/products',
  );

  return uploadResult.secure_url;
};

const uploadVersionImages = async (
  versions: ProductVersionInput[] | undefined,
  versionImageFiles: Express.Multer.File[],
) => {
  if (!versionImageFiles.length) {
    return versions;
  }

  if (!versions?.length) {
    throw new ProductServiceError('Version data is required when uploading version images', 400);
  }

  if (versionImageFiles.length > versions.length) {
    throw new ProductServiceError('Version image count cannot exceed version count', 400);
  }

  const nextVersions = [...versions];

  for (const [index, file] of versionImageFiles.entries()) {
    const uploadResult = await uploadToCloudinary(
      file.buffer,
      file.originalname,
      'fashion-ecommerce/products/versions',
    );

    nextVersions[index] = {
      ...nextVersions[index],
      version_image: uploadResult.secure_url,
    };
  }

  return nextVersions;
};

const deleteCloudinaryImage = async (imageUrl?: string | null) => {
  if (!imageUrl) {
    return;
  }

  try {
    const publicId = extractPublicIdFromUrl(imageUrl);
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.warn('Failed to delete image from Cloudinary:', error);
  }
};

const deleteProductImages = async (product: Awaited<ReturnType<typeof productService.getProductById>>) => {
  await deleteCloudinaryImage(product.product_image);

  await Promise.all(
    product.version.map((version: IProductVersion) => deleteCloudinaryImage(version.version_image)),
  );
};

const createProduct = async (req: Request, res: Response) => {
  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const input = {
      ...(req.body as CreateProductInput),
      version: parseVersions(req.body.version),
    };
    const productImageFile = getUploadedFiles(req, 'product_image')[0];
    const versionImageFiles = getUploadedFiles(req, 'version_images');

    if (!input.category_id || !input.name || !input.brand_id || !input.description) {
      return res.status(400).json({
        message: 'Category, name, brand, and description are required',
      });
    }

    let productImageUrl: string;
    if (productImageFile) {
      productImageUrl = await uploadProductImage(productImageFile);
    } else if (input.product_image) {
      productImageUrl = input.product_image;
    } else {
      return res.status(400).json({
        message: 'Product image is required (upload file or provide image URL)',
      });
    }

    const versions = await uploadVersionImages(input.version, versionImageFiles);

    const productInput: CreateProductInput = {
      ...input,
      product_image: productImageUrl,
      version: versions,
    };

    const product = await productService.createProduct(productInput);

    return res.status(201).json({ status: 'OK', data: product });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const updateProduct = async (req: Request, res: Response) => {
  try {
    const uploadReq = req as MulterRequest;
    const multerErrorResponse = handleMulterError(uploadReq.fileValidationError, res);
    if (multerErrorResponse) return;

    const productId = req.params.id as string;
    const input = {
      ...(req.body as UpdateProductInput),
      version: parseVersions(req.body.version),
    };
    const productImageFile = getUploadedFiles(req, 'product_image')[0];
    const versionImageFiles = getUploadedFiles(req, 'version_images');
    const updateData: UpdateProductInput = {};

    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.brand_id !== undefined) updateData.brand_id = input.brand_id;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.sold_quantity !== undefined) updateData.sold_quantity = input.sold_quantity;
    if (input.averageRating !== undefined) updateData.averageRating = input.averageRating;
    if (input.reviewCount !== undefined) updateData.reviewCount = input.reviewCount;

    const shouldReplaceProductImage = Boolean(productImageFile);
    const shouldReplaceVersions = input.version !== undefined || versionImageFiles.length > 0;
    const currentProduct =
      shouldReplaceProductImage || shouldReplaceVersions
        ? await productService.getProductById(productId)
        : null;

    if (productImageFile) {
      await deleteCloudinaryImage(currentProduct?.product_image);
      updateData.product_image = await uploadProductImage(productImageFile);
    } else if (input.product_image !== undefined) {
      updateData.product_image = input.product_image;
    }

    if (shouldReplaceVersions) {
      const versions = await uploadVersionImages(input.version, versionImageFiles);

      if (versions !== undefined) {
        await Promise.all(
          currentProduct?.version.map((version: IProductVersion) =>
            deleteCloudinaryImage(version.version_image),
          ) ?? [],
        );
        updateData.version = versions;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No data to update' });
    }

    const product = await productService.updateProduct(productId, updateData);

    return res.status(200).json({ status: 'OK', data: product });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const deleteProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;

    const product = await productService.getProductById(productId);
    await deleteProductImages(product);

    const updatedProduct = await productService.deleteProduct(productId);

    return res.status(200).json({ status: 'OK', data: updatedProduct });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const getProducts = async (_req: Request, res: Response) => {
  try {
    const products = await productService.getProducts();

    return res.status(200).json({ status: 'OK', data: products });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const getProductById = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;
    const product = await productService.getProductById(productId);

    return res.status(200).json({ status: 'OK', data: product });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

export { createProduct, updateProduct, deleteProduct, getProducts, getProductById };
