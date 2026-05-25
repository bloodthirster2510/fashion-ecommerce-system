import { Types } from 'mongoose';
import { Category } from '../../../database/models/category.model';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.type';

export class CategoryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CategoryServiceError';
  }
}

const assertValidCategoryId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new CategoryServiceError('Invalid category id', 400);
  }
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeParentId = (parentId?: string | null) => {
  return parentId ? new Types.ObjectId(parentId) : null;
};

const assertValidParentId = async (parentId?: string | null, currentCategoryId?: string) => {
  if (!parentId) {
    return;
  }

  assertValidCategoryId(parentId);

  if (currentCategoryId && parentId === currentCategoryId) {
    throw new CategoryServiceError('Category cannot be its own parent', 400);
  }

  const parentCategory = await Category.findById(parentId);

  if (!parentCategory) {
    throw new CategoryServiceError('Parent category not found', 404);
  }
};

const findCategoryByUniqueFields = (
  name: string,
  parentId: string | null | undefined,
  gender: string,
) => {
  return Category.findOne({
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
    parent_id: normalizeParentId(parentId),
    gender,
  });
};

const createCategory = async (input: CreateCategoryInput) => {
  await assertValidParentId(input.parent_id);

  const existingCategory = await findCategoryByUniqueFields(
    input.name,
    input.parent_id,
    input.gender,
  );

  if (existingCategory) {
    throw new CategoryServiceError('Category already exists', 409);
  }

  return Category.create({
    name: input.name.trim(),
    parent_id: normalizeParentId(input.parent_id),
    level: input.level,
    gender: input.gender,
    image: input.image.trim(),
    bannerImage: input.bannerImage?.trim() || null,
    description: input.description.trim(),
    isActive: input.isActive ?? true,
  });
};

const updateCategory = async (id: string, input: UpdateCategoryInput) => {
  assertValidCategoryId(id);
  await assertValidParentId(input.parent_id, id);

  const category = await Category.findById(id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  const nextName = input.name ?? category.name;
  const nextParentId = input.parent_id !== undefined ? input.parent_id : category.parent_id?.toString() ?? null;
  const nextGender = input.gender ?? category.gender;

  if (input.name !== undefined || input.parent_id !== undefined || input.gender !== undefined) {
    const existingCategory = await findCategoryByUniqueFields(nextName, nextParentId, nextGender);

    if (existingCategory && existingCategory._id.toString() !== id) {
      throw new CategoryServiceError('Category already exists', 409);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.parent_id !== undefined) updateData.parent_id = normalizeParentId(input.parent_id);
  if (input.level !== undefined) updateData.level = input.level;
  if (input.gender !== undefined) updateData.gender = input.gender;
  if (input.image !== undefined) updateData.image = input.image.trim();
  if (input.bannerImage !== undefined) updateData.bannerImage = input.bannerImage?.trim() || null;
  if (input.description !== undefined) updateData.description = input.description.trim();
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  return Category.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteCategory = async (id: string) => {
  assertValidCategoryId(id);

  const category = await Category.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  return category;
};

const getCategories = () => {
  return Category.find().sort({ createdAt: -1 });
};

const getActiveCategories = () => {
  return Category.find({ isActive: true }).sort({ createdAt: -1 });
};

const getCategoryById = async (id: string) => {
  assertValidCategoryId(id);

  const category = await Category.findById(id);

  if (!category) {
    throw new CategoryServiceError('Category not found', 404);
  }

  return category;
};

export const categoryService = {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getActiveCategories,
  getCategoryById,
};
