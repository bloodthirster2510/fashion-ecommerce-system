export interface ProductMeasurementValueInput {
  key: string;
  value: number;
}

export interface ProductSizeMeasurementInput {
  size: string;
  measurements: ProductMeasurementValueInput[];
}

export interface ProductColorVariantInput {
  color: string;
  colorCode?: string;
  image: string;
}

export interface ProductVariantInput {
  fitTypeId: string;
  price: number;
  discount: number;
  sizeMeasurements: ProductSizeMeasurementInput[];
  colors: ProductColorVariantInput[];
  isActive?: boolean;
}

export interface CreateProductInput {
  category_id: string;
  name: string;
  brand_id: string;
  variant?: ProductVariantInput[];
  description: string;
  product_image: string;
  isActive?: boolean;
}

export interface UpdateProductInput {
  category_id?: string;
  name?: string;
  brand_id?: string;
  variant?: ProductVariantInput[];
  description?: string;
  product_image?: string;
  isActive?: boolean;
  sold_quantity?: number;
  averageRating?: number;
  reviewCount?: number;
}

export type ProductGenderFilter = 'male' | 'female' | 'unisex';

export type ProductSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'best_seller'
  | 'rating_desc';

export interface ProductListQueryInput {
  keyword?: string;
  gender?: ProductGenderFilter;
  categoryId?: string;
  brandId?: string;
  color?: string[];
  fitType?: string[];
  size?: string[];
  minPrice?: number;
  maxPrice?: number;
  isSale?: boolean;
  isNew?: boolean;
  sort?: ProductSortOption;
  page?: number;
  limit?: number;
}

export interface ProductListItem {
  _id: string;
  name: string;
  image: string;
  price: number;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  isSale: boolean;
  isNew: boolean;
  isAvailable: boolean;
  soldQuantity: number;
  averageRating: number;
  reviewCount: number;
  brand: {
    _id: string;
    name: string;
    image?: string;
  } | null;
  category: {
    _id: string;
    name: string;
    gender?: ProductGenderFilter;
    image?: string;
    bannerImage?: string | null;
  } | null;
}

export interface ProductListResponse {
  items: ProductListItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    brands: Array<{ _id: string; name: string; image?: string }>;
    colors: string[];
    fitTypes: string[];
    categories: Array<{
      _id: string;
      name: string;
      gender?: ProductGenderFilter;
      parent_id?: string | null;
      level?: number;
      image?: string;
      bannerImage?: string | null;
    }>;
  };
}
