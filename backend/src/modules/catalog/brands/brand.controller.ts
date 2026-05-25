import type { Request, Response } from 'express';
import { BrandServiceError, brandService } from './brand.service';
import type { CreateBrandInput, UpdateBrandInput } from './brand.types';

const getErrorResponse = (e: unknown) => {
  if (e instanceof BrandServiceError) {
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

const createBrand = async (req: Request, res: Response) => {
  try {
    const { name, image } = req.body as CreateBrandInput;

    if (!name || !image) {
      return res.status(400).json({ message: 'Name and image are required' });
    }

    const brand = await brandService.createBrand({ name, image });

    return res.status(201).json({ status: 'OK', data: brand });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const updateBrand = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const { name, image, isActive } = req.body as UpdateBrandInput;
    const updateData: UpdateBrandInput = {};

    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No data to update' });
    }

    const brand = await brandService.updateBrand(id, updateData);

    return res.status(200).json({ status: 'OK', data: brand });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const deleteBrand = async (req: Request, res: Response) => {
  try {
    const brandId = req.params.id as string;

    const brand = await brandService.deleteBrand(brandId);

    return res.status(200).json({ status: 'OK', data: brand });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const getBrands = async (_req: Request, res: Response) => {
  try {
    const brands = await brandService.getBrands();

    return res.status(200).json({ status: 'OK', data: brands });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

export { createBrand, updateBrand, deleteBrand, getBrands };
