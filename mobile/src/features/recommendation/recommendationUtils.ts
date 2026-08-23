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

export const getVisibleRatioInViewport = (
  itemY: number,
  itemHeight: number,
  viewportHeight: number,
) => {
  if (itemHeight <= 0 || viewportHeight <= 0) {
    return 0;
  }

  const visibleHeight = Math.max(
    0,
    Math.min(itemY + itemHeight, viewportHeight) - Math.max(itemY, 0),
  );
  return visibleHeight / itemHeight;
};
