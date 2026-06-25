export interface CreateReviewInput {
  orderId: string;
  orderItemId: string;
  rating: number;
  comment: string;
  criteria?: ReviewCriteriaInput;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
  criteria?: ReviewCriteriaInput | null;
  keepImageIds?: string[];
}

export type ReviewSizeFit = 'small' | 'true_to_size' | 'large';

export interface ReviewCriteriaInput {
  productQuality?: number;
  descriptionMatch?: number;
  sizeFit?: ReviewSizeFit;
}

export interface ReviewListQueryInput {
  page?: number;
  limit?: number;
  rating?: number;
  sort?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'helpful';
}

export interface EligibleReviewItemsQueryInput {
  page?: number;
  limit?: number;
  status?: 'eligible' | 'reviewed' | 'all';
  productId?: string;
}

export type ReviewModerationStatus = 'pending' | 'visible' | 'hidden';

export type ReviewEligibilityReason =
  | 'ORDER_NOT_FOUND'
  | 'NOT_DELIVERED'
  | 'NOT_PAID'
  | 'ITEM_NOT_FOUND'
  | 'ALREADY_REVIEWED'
  | 'PRODUCT_UNAVAILABLE';

export type ReviewAdminActor = {
  userId: string;
  role: 'admin' | 'staff';
};

export interface AdminReviewListQueryInput {
  page?: number;
  limit?: number;
  keyword?: string;
  rating?: number;
  status?: ReviewModerationStatus;
  productId?: string;
  period?: 'today' | 'week' | 'month';
  hasImages?: boolean;
}
