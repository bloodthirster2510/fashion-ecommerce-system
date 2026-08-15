import type { RecommendationItem, RecommendationReasonCode } from './recommendationApi';

const reasonLabels: Record<RecommendationReasonCode, string> = {
  same_category: 'Cùng danh mục',
  same_brand: 'Cùng thương hiệu',
  same_gender: 'Cùng phong cách',
  same_color: 'Màu sắc tương tự',
  similar_price: 'Khoảng giá tương tự',
  preferred_category: 'Hợp sở thích của bạn',
  preferred_brand: 'Thương hiệu bạn quan tâm',
  preferred_color: 'Màu bạn hay xem',
  completes_outfit: 'Hoàn thiện set đồ',
  matches_cart_style: 'Hợp với giỏ hàng',
  frequently_bought_together: 'Thường được mua cùng',
  admin_pinned: 'Nổi bật',
  popular: 'Đang được yêu thích',
  on_sale: 'Đang có ưu đãi',
  new_arrival: 'Hàng mới',
};

export const getRecommendationReasonLabel = (item: RecommendationItem) => {
  const reasonCode = item.reasonCodes.find((code) => reasonLabels[code]);
  return reasonCode ? reasonLabels[reasonCode] : 'Gợi ý phù hợp';
};

type TrackableRecommendationItem = {
  product: {
    _id: string;
  };
};

export const getUnsentVisibleRecommendationItems = <T extends TrackableRecommendationItem>(
  items: T[],
  visibleProductIds: Set<string>,
  sentProductIds: Set<string>,
) => items.filter((item) => (
  visibleProductIds.has(item.product._id) && !sentProductIds.has(item.product._id)
));
