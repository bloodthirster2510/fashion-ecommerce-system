export interface AddCartItemInput {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size: string;
  quantity: number;
  isSelected?: boolean;
  replaceQuantity?: boolean;
  recommendationRequestId?: string;
  recommendationSessionId?: string;
}

export interface UpdateCartItemInput {
  size?: string;
  quantity?: number;
}

export interface SelectCartItemInput {
  isSelected: boolean;
}

export interface SelectAllCartItemsInput {
  isSelected: boolean;
}
