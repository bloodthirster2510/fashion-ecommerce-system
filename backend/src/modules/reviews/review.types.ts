export interface CreateReviewInput {
  productId: string;
  rating: number;
  comment: string;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
}

export interface ReviewListQueryInput {
  page?: number;
  limit?: number;
  rating?: number;
  sort?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc';
}

export type ReviewModerationStatus = 'pending' | 'visible' | 'hidden';

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
