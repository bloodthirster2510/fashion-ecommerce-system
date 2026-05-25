export interface ProductSizeSpecInput {
  size: string;
  shoulder: number;
  chest: number;
  length: number;
  weight: number;
  stock_quantity?: number;
}

export interface ProductVersionInput {
  sku: string;
  color: string;
  fitType: string;
  size_spec: ProductSizeSpecInput[];
  version_image: string;
  image_embedding?: number[];
  price: number;
  discount: number;
  isAvailable?: boolean;
  import?: string[];
}

export interface CreateProductInput {
  category_id: string;
  name: string;
  brand_id: string;
  version?: ProductVersionInput[];
  description: string;
  product_image: string;
  isActive?: boolean;
}

export interface UpdateProductInput {
  category_id?: string;
  name?: string;
  brand_id?: string;
  version?: ProductVersionInput[];
  description?: string;
  product_image?: string;
  isActive?: boolean;
  sold_quantity?: number;
  averageRating?: number;
  reviewCount?: number;
}
