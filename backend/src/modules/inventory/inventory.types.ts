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
  supplierName?: string;
  detail: InventoryImportDetailInput[];
}

export type InventoryReceiptStatus = 'draft' | 'confirmed' | 'cancelled';

export interface InventoryReceiptLineDetailInput {
  size: string;
  quantity: number;
  importPrice?: number;
}

export interface InventoryReceiptLineInput {
  productId: string;
  variantId: string;
  colorVariantId: string;
  detail: InventoryReceiptLineDetailInput[];
}

export interface CreateInventoryReceiptInput {
  receiptCode?: string;
  supplierName?: string;
  importDate?: Date;
  status?: InventoryReceiptStatus;
  note?: string;
  lines?: InventoryReceiptLineInput[];
}

export interface UpdateInventoryReceiptInput {
  receiptCode?: string;
  supplierName?: string;
  importDate?: Date;
  note?: string;
  lines?: InventoryReceiptLineInput[];
}

export interface InventoryListQueryInput {
  productId?: string;
  variantId?: string;
  colorVariantId?: string;
  size?: string;
  page?: number;
  limit?: number;
}

export interface InventoryMovementListQueryInput extends InventoryListQueryInput {
  type?: string;
  from?: Date;
  to?: Date;
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

export interface InventoryReceiptListQueryInput {
  status?: InventoryReceiptStatus;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface AdjustInventoryInput {
  quantity?: number;
  deltaQuantity?: number;
  reason?: string;
  note?: string;
}

export interface UpdateInventoryThresholdInput {
  lowStockThreshold: number;
}

export interface UpsertInventorySupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  isActive?: boolean;
}

export interface CreateStocktakeLineInput {
  inventoryId: string;
  countedQuantity: number;
  reason?: string;
}

export interface CreateStocktakeInput {
  stocktakeCode?: string;
  note?: string;
  lines: CreateStocktakeLineInput[];
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
