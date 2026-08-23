import type {
  ProductGenderFilter,
  ProductListItem,
  ProductSortOption,
} from '../catalog/products/product.types';

export type FavoriteSortOption = Exclude<ProductSortOption, 'relevance'> | 'favorited_desc' | 'favorited_asc';

export interface FavoriteListQueryInput {
  keyword?: string;
  categoryId?: string[];
  brandId?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: FavoriteSortOption;
  page?: number;
  limit?: number;
}

export interface AddFavoriteInput {
  productId: string;
}

export interface FavoriteStatusResponse {
  productId: string;
  isFavorited: boolean;
}

export interface FavoriteProductItem extends ProductListItem {
  favoritedAt: string;
  isFavorited: true;
  category: (ProductListItem['category'] & { gender?: ProductGenderFilter }) | null;
}

export interface FavoriteListResponse {
  items: FavoriteProductItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
