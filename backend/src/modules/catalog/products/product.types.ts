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
  categoryId?: string[];
  brandId?: string[];
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
    sizes: string[];
    categories: Array<{
      _id: string;
      name: string;
      gender?: ProductGenderFilter;
      parent_id?: string | null;
      level?: number;
      image?: string;
    }>;
  };
}

export interface ProductDetailColor {
  _id: string;
  color: string;
  colorCode?: string;
  image: string;
}

export interface ProductCategoryBreadcrumbItem {
  _id: string;
  name: string;
  gender?: ProductGenderFilter;
  parent_id?: string | null;
  level?: number;
}

export interface ProductDetailMeasurement {
  key: string;
  label?: string;
  unit?: string;
  value: number;
}

export interface ProductDetailSize {
  size: string;
  measurements: ProductDetailMeasurement[];
  isAvailable: boolean;
  availableQuantity?: number;
}

export interface ProductDetailFitType {
  _id: string;
  key: string;
  label: string;
}

export interface ProductDetailInventoryItem {
  colorVariantId: string;
  size: string;
  sku: string;
  availableQuantity: number;
  isAvailable: boolean;
}

export interface ProductDetailVariant {
  _id: string;
  fitTypeId: string;
  fitType: ProductDetailFitType | null;
  price: number;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  isSale: boolean;
  isActive: boolean;
  colors: ProductDetailColor[];
  sizes: ProductDetailSize[];
  inventory: ProductDetailInventoryItem[];
}

export interface ProductDetailResponse {
  _id: string;
  name: string;
  description: string;
  productImage: string;
  gallery: string[];
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
  } | null;
  categoryBreadcrumb: ProductCategoryBreadcrumbItem[];
  variants: ProductDetailVariant[];
  selectedVariantId?: string;
  colors: ProductDetailColor[];
  sizes: string[];
  ratingSummary: {
    averageRating: number;
    reviewCount: number;
    distribution: Array<{ rating: 1 | 2 | 3 | 4 | 5; count: number; percent: number }>;
  };
  policies: Array<{ icon: string; title: string; description: string }>;
}
