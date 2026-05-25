import type { CategoryGender } from '../../../database/models/category.model';

export interface CreateCategoryInput {
  name: string;
  parent_id?: string | null;
  level: number;
  gender: CategoryGender;
  image: string;
  bannerImage?: string | null;
  description: string;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  parent_id?: string | null;
  level?: number;
  gender?: CategoryGender;
  image?: string;
  bannerImage?: string | null;
  description?: string;
  isActive?: boolean;
}