export interface InventoryImportDetailInput {
  size: string;
  quantity: number;
  remainingQuantity?: number;
  importPrice?: number;
}

export interface CreateInventoryImportInput {
  productId: string;
  variantId: string;
  colorVariantId: string;
  detail: InventoryImportDetailInput[];
}

export interface InventoryListQueryInput {
  productId?: string;
  variantId?: string;
  colorVariantId?: string;
  size?: string;
  page?: number;
  limit?: number;
}

export interface InventoryImportListQueryInput {
  productId?: string;
  variantId?: string;
  colorVariantId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface AdjustInventoryInput {
  quantity?: number;
  deltaQuantity?: number;
}

export interface InventoryReservationItemInput {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size: string;
  quantity: number;
}

export interface ReserveInventoryInput {
  userId: string;
  orderId?: string | null;
  expiresAt?: Date;
  ttlMinutes?: number;
  items: InventoryReservationItemInput[];
}

export interface ReservationSelectorInput {
  reservationIds?: string[];
  orderId?: string;
}
