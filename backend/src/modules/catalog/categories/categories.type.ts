import type { CategoryGender } from '../../../database/models/category.model';

export interface MeasurementFieldInput {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  sortOrder: number;
}

export interface CategoryFitTypeInput {
  key: string;
  label: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  parent_id?: string | null;
  level: number;
  gender: CategoryGender;
  image: string;
  description: string;
  isLeaf?: boolean;
  isSizeTemplateSource?: boolean;
  sizeTemplateSourceId?: string | null;
  sizes?: string[];
  measurementFields?: MeasurementFieldInput[];
  fitTypes?: CategoryFitTypeInput[];
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  parent_id?: string | null;
  level?: number;
  gender?: CategoryGender;
  image?: string;
  description?: string;
  isLeaf?: boolean;
  isSizeTemplateSource?: boolean;
  sizeTemplateSourceId?: string | null;
  sizes?: string[];
  measurementFields?: MeasurementFieldInput[];
  fitTypes?: CategoryFitTypeInput[];
  isActive?: boolean;
}

export interface UpsertCategorySizeTemplateInput {
  name?: string;
  sizes: string[];
  measurementFields?: MeasurementFieldInput[];
  categoryIds?: string[];
  excludedCategoryIds?: string[];
}

export interface CategoryListQueryInput {
  gender?: CategoryGender;
  parentId?: string | null;
  activeOnly?: boolean;
}
