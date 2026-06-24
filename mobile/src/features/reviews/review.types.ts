export type ReviewImageDraft = { uri: string; name: string; type: string };
export type ReviewImage = { _id: string | null; url: string; thumbnailUrl: string };
export type ReviewCriteria = {
  productQuality?: number;
  descriptionMatch?: number;
  sizeFit?: 'small' | 'true_to_size' | 'large';
};

export type ReviewEligibility = {
  canReview: boolean;
  reason: 'ORDER_NOT_FOUND' | 'NOT_DELIVERED' | 'NOT_PAID' | 'ITEM_NOT_FOUND' | 'ALREADY_REVIEWED' | 'PRODUCT_UNAVAILABLE' | null;
  reviewId: string | null;
  reviewStatus: 'pending' | 'visible' | 'hidden' | null;
};

export type CreatedReview = {
  _id: string;
  rating: number;
  comment: string;
  moderationStatus: 'pending' | 'visible' | 'hidden';
  moderationReasons: string[];
};

export type PublicReview = {
  _id: string;
  rating: number;
  comment: string;
  images: ReviewImage[];
  criteria: ReviewCriteria | null;
  verifiedPurchase: boolean;
  purchasedVariant: { fitType: string; color: string; size: string; sku: string } | null;
  user: { _id: string; name: string | null; avatarImage: string | null };
  adminReply: { content: string; repliedAt: string | null } | null;
  helpfulCount: number;
  hasVotedHelpful: boolean;
  createdAt: string;
};

export type PublicReviewList = {
  items: PublicReview[];
  summary: {
    averageRating: number;
    reviewCount: number;
    distribution: Array<{ rating: number; count: number; percent: number }>;
  };
  pagination: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type MyReview = PublicReview & {
  orderId: string;
  orderItemId: string;
  moderationStatus: 'pending' | 'visible' | 'hidden';
  moderationReasons: string[];
  product: { _id: string; name: string; image: string };
};

export type MyReviewList = {
  items: MyReview[];
  pagination: { page: number; limit: number; totalItems: number; totalPages: number };
};

export type EligibleReviewItem = {
  orderId: string;
  orderItemId: string;
  orderCode: string;
  canReview: boolean;
  reason: 'PRODUCT_UNAVAILABLE' | 'ALREADY_REVIEWED' | null;
  review: {
    _id: string;
    rating: number;
    comment: string;
    status: 'pending' | 'visible' | 'hidden';
    moderationReasons: string[];
    createdAt: string;
  } | null;
};

export type EligibleReviewItemsResponse = {
  items: EligibleReviewItem[];
  pagination: { page: number; limit: number; totalItems: number; totalPages: number };
};
