import type { Request, Response } from 'express';
import { ProductServiceError, productService } from './product.service';
import type { CreateProductInput, UpdateProductInput } from './product.types';

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

const createProduct = async (req: Request, res: Response) => {
  try {
    const input = req.body as CreateProductInput;

    if (!input.category_id || !input.name || !input.brand_id ||!input.description || !input.product_image
    ) {
      return res.status(400).json({
        message: 'Category, name, brand, description, and product image are required',
      });
    }

    const product = await productService.createProduct(input);

    return res.status(201).json({ status: 'OK', data: product });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const updateProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.id as string;
    const input = req.body as UpdateProductInput;
    const updateData: UpdateProductInput = {};

    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.brand_id !== undefined) updateData.brand_id = input.brand_id;
    if (input.version !== undefined) updateData.version = input.version;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.product_image !== undefined) updateData.product_image = input.product_image;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.sold_quantity !== undefined) updateData.sold_quantity = input.sold_quantity;
    if (input.averageRating !== undefined) updateData.averageRating = input.averageRating;
    if (input.reviewCount !== undefined) updateData.reviewCount = input.reviewCount;

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
    const product = await productService.deleteProduct(productId);

    return res.status(200).json({ status: 'OK', data: product });
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
