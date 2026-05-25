import type { Request, Response } from 'express';
import { CategoryServiceError, categoryService } from './categories.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.type';

const getErrorResponse = (e: unknown) => {
  if (e instanceof CategoryServiceError) {
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

const createCategory = async (req: Request, res: Response) => {
  try {
    const input = req.body as CreateCategoryInput;

    if (!input.name || input.level === undefined || !input.gender || !input.image || !input.description) {
      return res.status(400).json({
        message: 'Name, level, gender, image, and description are required',
      });
    }

    const category = await categoryService.createCategory(input);

    return res.status(201).json({ status: 'OK', data: category });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const input = req.body as UpdateCategoryInput;
    const updateData: UpdateCategoryInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.parent_id !== undefined) updateData.parent_id = input.parent_id;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.image !== undefined) updateData.image = input.image;
    if (input.bannerImage !== undefined) updateData.bannerImage = input.bannerImage;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No data to update' });
    }

    const category = await categoryService.updateCategory(id, updateData);

    return res.status(200).json({ status: 'OK', data: category });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const deleteCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.id as string;
    const category = await categoryService.deleteCategory(categoryId);

    return res.status(200).json({ status: 'OK', data: category });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getCategories();

    return res.status(200).json({ status: 'OK', data: categories });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

const getCategoryById = async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.id as string;
    const category = await categoryService.getCategoryById(categoryId);

    return res.status(200).json({ status: 'OK', data: category });
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return res.status(statusCode).json({ message });
  }
};

export { createCategory, updateCategory, deleteCategory, getCategories, getCategoryById };